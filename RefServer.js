const http = require('http')
const fs = require('fs')
const path = require('path')
const express = require('express')
const archiver = require('archiver')
const cors = require('cors')
const csvParser = require('csv-parser')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const zlib = require('zlib')
const extract = require('extract-zip') // 需要安装 `npm install extract-zip`
const decompress = require('decompress')

const app = express()
const PORT = 7173

// 解析 JSON 请求体
app.use(express.json())
app.use(cors())

const downloadPath = '../../home/LYN/zj_algorithm/data20241113/data_3000.zip'
// const downloadUrl = 'http://localhost:5173/train2017.zip'
// const downloadPath = path.join(__dirname, 'images.zip')
const imageDir = path.join(__dirname, 'result/images')
const labelDir = 'result/labels'
const excelPath = path.join(__dirname, 'result', 'quality.csv')

// 下载压缩包
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    http
      .get(url, (response) => {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {}) // 删除已下载的部分文件
        reject(err)
      })
  })
}

// 解压压缩包
function extractZip(src, dest) {
  return new Promise((resolve, reject) => {
    decompress(src, dest)
      .then((files) => {
        console.log('解压完成:', files)
        resolve()
      })
      .catch((err) => {
        console.error('解压出错:', err)
        reject(err)
      })
  })
}

// 主函数
async function main() {
  try {
    // console.log('Downloading zip file...')
    // 确保目录存在
    // if (!fs.existsSync(path.dirname(downloadPath))) {
    //   fs.mkdirSync(path.dirname(downloadPath), { recursive: true })
    // }

    // console.log('Downloading zip file from:', downloadUrl)
    // await downloadFile(downloadUrl, downloadPath)
    // console.log('Download complete.')

    console.log('Extracting zip file...')
    await extractZip(downloadPath, imageDir)
    console.log('Extraction complete.')

    // 可选：删除下载的压缩包
    fs.unlinkSync(downloadPath)
    console.log('Downloaded zip file deleted.')
  } catch (error) {
    console.error('Error:', error.message)
  }
}
// main()

// 获取图片列表
app.get('/list-images', (req, res) => {
  try {
    // 确保目录存在
    if (!fs.existsSync(imageDir)) {
      main()
    }

    // 获取图片文件列表
    const imageList = fs
      .readdirSync(imageDir)
      .filter((file) =>
        ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase())
      )
      .map((file) => {
        const fileName = file
        return {
          name: fileName,
          status: false,
        }
      })

    // 检查文件是否存在
    const fileExists = fs.existsSync(excelPath)
    if (fileExists) {
      // 读取 CSV 文件并解析为数组
      const records = []
      fs.createReadStream(excelPath)
        .pipe(csvParser())
        .on('data', (row) => {
          records.push(row)
        })
        .on('end', () => {
          // 创建一个映射表，用于快速查找
          const imageMap = new Map()
          imageList.forEach((item) => {
            imageMap.set(item.name, item)
          })

          records.forEach((row) => {
            // 检查 image_name 是否存在
            const imageName = row['image_name']
            if (imageName === undefined) {
              console.warn(`Missing 'image_name' in row: ${JSON.stringify(row)}`)
              return
            }

            // 打印 image_name
            console.log(imageName)

            // 更新状态
            const item = imageMap.get(imageName)
            if (item) {
              item.status = true
            }
          })

          console.log('Image List:', imageList)
          res.status(200).json({ list: imageList })
        })
    } else {
      res.status(200).json({ list: imageList })
    }
  } catch (error) {
    console.error('获取图片列表失败:', error)
    res.status(500).json({ error: '获取图片列表失败' })
  }
})

// 获取单个图片文件
app.get('/images/:filename', (req, res) => {
  const filename = req.params.filename
  const imagePath = path.join(imageDir, filename)

  // 检查文件是否存在
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: '文件未找到' })
  }

  // 发送文件
  res.sendFile(imagePath)
})

// 处理创建文本文件的请求
app.post('/create-txt', (req, res) => {
  const { content, fileName } = req.body
  const filePath = path.join(__dirname, labelDir, fileName)

  console.log(filePath)

  // 确保目录存在
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  const list = JSON.parse(content)

  const ws = fs.createWriteStream(filePath) // 创建流式写入实例，传入路径为参数

  list.forEach((item) => {
    ws.write(item.value + ' \r\n') // 写入
  })

  ws.close() // 关闭流
  res.status(200).send('File created successfully.')
})

// 处理从 CSV 文件中添加新记录的请求
app.post('/add-record-to-csv', (req, res) => {
  const { newRecord } = req.body

  // 检查 filePath 和 newRecord 是否存在
  if (!newRecord) {
    res.status(400).json({ error: 'Invalid request data' })
  }

  try {
    // 检查文件是否存在
    const fileExists = fs.existsSync(excelPath)

    // 获取 CSV 文件的列头
    const headers = Object.keys(newRecord)

    // 创建 CSV writer
    const csvWriter = createCsvWriter({
      path: excelPath,
      header: headers.map((header) => ({ id: header, title: header })),
    })

    // 如果文件不存在，则创建新文件并写入新记录
    if (!fileExists) {
      csvWriter
        .writeRecords([newRecord])
        .then(() => {
          console.log('New CSV file created and record added successfully.')
          res.status(200).json({
            message: 'New CSV file created and record added successfully.',
          })
        })
        .catch((err) => {
          console.error('Error creating CSV file:', err)
          res.status(500).json({ error: 'Error creating CSV file' })
        })
    } else {
      // 读取 CSV 文件并解析为数组
      const records = []
      fs.createReadStream(excelPath)
        .pipe(csvParser())
        .on('data', (row) => {
          records.push(row)
        })
        .on('end', () => {
          var flag = true

          // 遍历记录，如果存在相同名称的记录，则更新其质量值
          records.forEach((row) => {
            console.log(row)
            if (row['image_name'] === newRecord['image_name']) {
              row['quality'] = newRecord['quality']
              flag = false
            }
          })

          // 添加新记录
          if (flag) {
            records.push(newRecord)
          }

          // 写入更新后的记录
          csvWriter
            .writeRecords(records)
            .then(() => {
              console.log('New record added successfully.')
              res.status(200).json({ message: 'New record added successfully.' })
            })
            .catch((err) => {
              console.error('Error writing to CSV file:', err)
              res.status(500).json({ error: 'Error writing to CSV file' })
            })
        })
        .on('error', (err) => {
          console.error('Error reading CSV file:', err)
          res.status(500).json({ error: 'Error reading CSV file' })
        })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    res.status(500).json({ error: 'Error processing request' })
  }
})

// 处理压缩文件夹并下载的请求
app.get('/download-zip', (req, res) => {
  const folderPath = path.join(__dirname, 'result')

  // 检查 folderPath 是否存在
  if (!folderPath) {
    res.status(400).json({ error: 'Invalid request data' })
  }

  // 确保文件夹路径存在
  if (!fs.existsSync(folderPath)) {
    res.status(400).json({ error: 'Folder does not exist' })
  }

  // 设置响应头
  res.attachment(path.basename(folderPath) + '.zip')

  // 创建一个 archiver 实例
  const archive = archiver('zip', {
    zlib: { level: 9 }, // 压缩级别
  })

  // 监听错误事件
  archive.on('error', function (err) {
    res.status(500).send({ error: err.message })
  })

  // 设置管道
  archive.pipe(res)

  // 添加要归档的文件
  archive.directory(folderPath, false)

  // 完成归档
  archive.finalize()
})

// 处理从文本文件中获取信息的请求
app.post('/get-info', async (req, res) => {
  const { fileName } = req.body

  const name = fileName.split('.')[0]

  const filePath = path.join(__dirname, labelDir, name + '.txt')

  // 检查文件是否存在
  const fileExists = fs.existsSync(filePath)
  if (!fileExists) {
    res.status(200).json({ content: null })
  } else {
    try {
      // 读取文件内容
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err)
          res.status(500).json({ error: 'Error reading file' })
        }

        // 返回文件内容
        res.status(200).json({ content: data })
      })
    } catch (error) {
      console.error('Error processing request:', error)
      res.status(500).json({ error: 'Error processing request' })
    }
  }
})

// 处理查找记录的请求
app.post('/get-record', async (req, res) => {
  const { fileName } = req.body

  console.log(fileName)
  try {
    // 检查文件是否存在
    const fileExists = fs.existsSync(excelPath)
    if (!fileExists) {
      res.status(200).json({ record: null })
    } else {
      // 读取 CSV 文件并解析为数组
      const records = []
      fs.createReadStream(excelPath)
        .pipe(csvParser())
        .on('data', (row) => {
          records.push(row)
        })
        .on('end', () => {
          var flag = true
          records.forEach((row) => {
            console.log(row)
            if (row['image_name'] === fileName) {
              console.log('Found record:', row['quality'])
              flag = false
              res.status(200).json({ record: row['quality'] })
            }
          })

          if (flag) {
            console.log('Not Found record:')
            res.status(200).json({ record: null })
          }
        })
        .on('error', (err) => {
          console.error('Error reading CSV file:', err)
          res.status(500).json({ error: 'Error reading CSV file' })
        })
    }
  } catch (error) {
    console.error('Error finding record in Excel:', error)
    res.status(500).json({ error: 'Error processing request' })
  }
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
