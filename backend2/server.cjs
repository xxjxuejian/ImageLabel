// 前端请求资源，后端处理完以后再返回给前端，前端直接拿到数据就能用
// 访问这个接口，进行一系列处理，返回前端需要的资源
const http = require('http')
const fs = require('fs')
const cors = require('cors')
const path = require('path')
const express = require('express')
const decompress = require('decompress')
const bodyParser = require('body-parser')

// 服务器上的数据集压缩包路径, 中间要加/
const datasetPath = path.join(__dirname, '/dataset/train2017.zip')
// 获取该路径的文件名称，不含后缀
const fileName = path.basename(datasetPath, path.extname(datasetPath)) //train2017

// 拿到数据集，解压，这个是解压后图片存储的目录路径
const extractDirPath = path.join(__dirname, '/extracted', fileName)
// 图片所在的路径
const imageDir = extractDirPath
// 保存标注数据的文件夹路径
const labelsDir = path.join(__dirname, 'result/labels')
// 图片质量分数的csv文件路径
const qualityCsvPath = path.join(__dirname, 'result/quality.csv')

// 检查文件夹是否为空
function isFolderEmpty(folderPath) {
  return fs.existsSync(folderPath) && fs.readdirSync(folderPath).length === 0
}

// 直接解压
// 1. 原压缩文件是否存在，如果不存在原文件，直接
// 2. 解压的路径是否存在
// 3. 之前有没有解压过

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors())
const PORT = 3000

async function extractZip(fromPath, toPath) {
  await decompress(fromPath, toPath)
  console.log('文件解压完成')
}

// 获取图片列表
app.get('/images', async (req, res) => {
  try {
    // 检查 zip 文件是否存在
    if (!fs.existsSync(datasetPath)) {
      return res.status(404).json({
        status: 'error',
        message: '资源文件不存在，请检查路径和文件名称',
      })
    }

    // 如果解压目录不存在或为空，则进行解压
    if (!fs.existsSync(imageDir) || isFolderEmpty(imageDir)) {
      console.log('解压目录不存在或为空，开始解压...')
      fs.mkdirSync(imageDir, { recursive: true }) // 递归创建目录
      // 解压文件
      await extractZip(datasetPath, imageDir)
    } else {
      console.log('解压目录已经存在且不为空')
    }

    // 文件已经存在
    // 获取图片文件列表
    const imageList = fs
      .readdirSync(imageDir)
      .filter((file) => /\.(jpg|jpeg|png|gif)$/.test(file))
      .map((file) => {
        const fileName = file
        const basename = fileName.match(/(\d+)\.(jpg|jpeg|png|gif)$/i)[1]
        // console.log('fileName--------', fileName, basename)
        //当前图片的标注转态
        let status = false
        let txtPath = `${labelsDir}/${basename}.txt`
        // console.log(txtPath)
        // 文件不存在，说明没有标注，只要文件存在，不论有没有内容都认为是标记了
        if (fs.existsSync(txtPath)) status = true
        return {
          name: fileName,
          // status表示有没有标志，如果没有这个图片对应的.txt文件，肯定是未标注
          // 但是也可能是有文件，但是内容为空，所以检查后端有没有质量分数，有的话，就是标注了
          status: status,
        }
      })

    console.log('imageList----', imageList)
    res.json(imageList)
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

// 获取单张图片的标注数据
app.get('/annotations/:imageName', (req, res) => {
  const imageName = req.params.imageName
  const filePath = path.join(labelsDir, `${imageName}.txt`)
  // 检查文件是否存在,// 如果文件不存在，直接返回空数组
  if (!fs.existsSync(filePath)) {
    // return res.status(404).json({ error: '标注文件未找到' })
    return res.json({ imageName, annotations: [] })
  }

  try {
    // 读取标注文件内容
    const content = fs.readFileSync(filePath, 'utf8')

    // 解析标注数据，将每行数据转换为对象
    // .filter(Boolean) 会处理空行情况,如果文件为空,返回的annotations数组为空
    const annotations = content
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [category, x, y, width, height] = line.split(',')
        return {
          category,
          x: parseFloat(x),
          y: parseFloat(y),
          width: parseFloat(width),
          height: parseFloat(height),
        }
      })

    console.log(annotations)
    res.json({ imageName, annotations })
  } catch (error) {
    console.error('读取标注数据时出错:', error)
    res.status(500).json({ error: '获取标注数据失败' })
  }
})

// 2. 保存/更新每张图片的标注数据到 `labels/` 文件夹
app.post('/annotations/:imageName', (req, res) => {
  const { imageName } = req.params
  const { annotations } = req.body

  if (!imageName || !annotations) {
    return res.status(400).json({ error: '图片名称或标注数据缺失' })
  }

  // 如果目录不存在
  if (!fs.existsSync(labelsDir)) {
    fs.mkdirSync(labelsDir, { recursive: true })
  }

  // 每一个文件名称是 name.txt,构建文件的路径名称
  const filePath = path.join(labelsDir, `${imageName}.txt`)

  // 如果提交的数据是空数组
  // if (annotations.length === 0) {
  // }

  // 每一个矩形标注拼接成 一行字符串，字符串末尾使用\n分割
  const content = annotations
    .map((annotation) => {
      // return `Category: ${annotation.category}, X: ${annotation.x}, Y: ${annotation.y}, Width: ${annotation.width}, Height: ${annotation.height}`
      return `${annotation.category},${annotation.x},${annotation.y},${annotation.width},${annotation.height}`
    })
    .join('\n')
  // content是一个多行的字符串，每行使用,分割，末尾使用了\n,这个content可以直接写入文件
  fs.writeFileSync(filePath, content, 'utf8')
  res.json({ message: '标注数据保存成功' })
})

// 获取单张图片的质量分数
app.get('/quality/:imageName', (req, res) => {
  const { imageName } = req.params

  // 检查 quality.csv 文件是否存在
  // 不存在就返回一个默认值。不要返回404
  if (!fs.existsSync(qualityCsvPath)) {
    // return res.status(404).json({ error: '质量分数数据未找到' })
    return res.json({ imageName, quality: 5 }) // 默认分数为 5
  }

  try {
    // 读取 CSV 文件内容并查找对应记录
    const fileData = fs.readFileSync(qualityCsvPath, 'utf8')
    const lines = fileData.split('\n').filter(Boolean)

    // 查找图片对应的质量分数
    // 实际上如果没有找到这张图片的质量分数，前端就认为是空的，前端会显示一个默认值，后端统一返回默认值
    const qualityRecord = lines.find((line) => line.startsWith(imageName + ','))
    console.log('qualityRecord', qualityRecord)
    if (!qualityRecord) {
      // return res.status(404).json({ error: '质量分数未找到' })
      return res.json({ imageName, quality: 5 }) // 默认分数为 5
    }

    // 解析记录并返回
    const [, quality] = qualityRecord.split(',')
    res.json({ imageName, quality: parseInt(quality, 10) })
  } catch (error) {
    console.error('读取质量分数时出错:', error)
    res.status(500).json({ error: '获取质量分数失败' })
  }
})

// 保存/更新每张图片的质量分数到 `quality.csv`
app.post('/quality', (req, res) => {
  const { imageName, quality } = req.body

  if (!imageName || !quality) {
    return res.status(400).json({ error: '图片名称或质量分数缺失' })
  }

  // 创建一个新的数组用于更新CSV内容
  let records = []
  let recordFound = false // 标记是否找到已有记录
  // 读取CSV文件
  if (fs.existsSync(qualityCsvPath)) {
    const fileData = fs.readFileSync(qualityCsvPath, 'utf8')
    const lines = fileData.trim().split('\n') //lines是数组

    // 遍历每一行找
    records = lines.map((line) => {
      const [existingImage] = line.split(',')

      // 如果找到已有的记录，更新质量分数,返回一行新的记录
      if (existingImage === imageName) {
        recordFound = true
        return `${imageName},${quality}`
      }
      // 如果没有找到，返回原来的记录
      else {
        return line
      }
    })
  }
  // 不存在要创建文件
  else {
    // 获取目录路径
    const dirPath = path.dirname(qualityCsvPath)
    console.log(dirPath)
    // 确保目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true }) // 使用 recursive 确保创建所有中间目录
    }
  }
  // 此时如果记录已找到，records内部是最新的全部数据
  // 如果记录未找到，添加新记录
  if (!recordFound) {
    records.push(`${imageName},${quality}`)
  }

  // 覆盖写入整个CSV文件
  fs.writeFileSync(qualityCsvPath, records.join('\n'), 'utf8')
  console.log(qualityCsvPath)
  console.log(records, records.join('\n'))
  res.json({ message: '质量分数保存成功' })
})

// 考虑一个问题,图片如果质量很差,就可以不标注,所以annotations数组可以为空
// 那么这条数据后端保存成什么？
// 一次性保存所有的图片的相关信息
app.post('/save-all', (req, res) => {
  // allImgsInfo是一个对象
  const allImgsInfo = req.body

  // 如果数据为空
  if (!allImgsInfo || Object.keys(allImgsInfo).length === 0) {
    return res.status(400).json({ error: '提交的数据不能为空' })
  }

  // 保存标注数据
  try {
    // 如果labelsDir目录不存在
    if (!fs.existsSync(labelsDir)) {
      fs.mkdirSync(labelsDir, { recursive: true })
    }

    const qualityArr = []
    Object.entries(allImgsInfo).forEach((item) => {
      // fileKey:000000000009.jpg
      // data:{ "quality": 2, "annotations":[] }
      const [fileKey, data] = item
      const fileName = fileKey.match(/(\d+)\.(jpg|jpeg|png|gif)$/i)[1]
      const fileAnoPath = path.join(labelsDir, `${fileName}.txt`)
      // 质量分数
      qualityArr.push(fileKey + ',' + data.quality)
      // console.log(fileName, fileAnoPath)

      // 保存每一个的标注文件
      const annotations = data.annotations.map((item) => {
        return `${item.category},${item.x},${item.y},${item.width},${item.height}`
      })
      const content = annotations.join('\n')

      // console.log('qualityArr', qualityArr)

      fs.writeFileSync(fileAnoPath, content, 'utf-8')
    })

    // 保存csv文件
    writeToCsv(qualityCsvPath, qualityArr.join('\n'))

    res.status(200).json({ message: '保存成功' })
  } catch (error) {}
})

app.get('/api/v1/images', async (req, res) => {
  try {
    // 如果请求的源文件都不存在，直接404
    // 检查 zip 文件是否存在
    if (!fs.existsSync(datasetPath)) {
      return res.status(404).json({
        status: 'error',
        message: '资源文件不存在，请检查路径和文件名称',
      })
    }
    // 如果解压目录不存在或为空，则进行解压
    if (!fs.existsSync(extractDirPath) || isFolderEmpty(extractDirPath)) {
      console.log('解压目录不存在或为空，开始解压...')
      fs.mkdirSync(extractDirPath, { recursive: true }) // 递归创建目录
      await extractZip(datasetPath, extractDirPath)
    } else {
      console.log('解压目录已经存在且不为空')
    }

    // 文件已经存在了
    // 获取解压目录中的文件列表
    const files = fs
      .readdirSync(extractDirPath)
      .filter((file) => /\.(jpg|jpeg|png|gif)$/.test(file))
      .map((file) => ({
        filename: file,
        url: `/images/${file}`,
      }))

    res.status(200).json({
      status: 'success',
      data: files,
    })
  } catch (error) {
    console.error('解压过程中出现错误:', error)
    res.status(500).json({
      status: 'error',
      message: '获取图片失败',
      error: error.message,
    })
  }
})

// 设置静态文件服务,可以少写 /images/:filename 接口
// app.use('/images', express.static(extractDirPath))
function writeToCsv(filepath, content) {
  // 获取目录路径
  const dirPath = path.dirname(filepath)
  console.log(dirPath)
  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true }) // 使用 recursive 确保创建所有中间目录
  }
  //
  console.log(filepath)
  fs.writeFileSync(filepath, content, 'utf8')
  // return 'ok'
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
