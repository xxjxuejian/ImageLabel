// 本地模拟
import http from 'http'
import fs from 'fs'
import path from 'path'
import express from 'express'
import { fileURLToPath } from 'url'
import unzipper from 'unzipper'

// 获取标注数据集的压缩包的接口
// console.log(http)
const app = express()
const PORT = 3000

// 模拟 `__dirname`
// 在 Node.js 的 ES 模块（即 type: "module"）中，__dirname 和 __filename 是不可用的
// 用 import.meta.url 来获得当前文件的路径并手动计算 __dirname。
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 模拟的远程服务器地址
const baseUrl = 'http://localhost:3000'

// 初始的数据集路径，可以认为是服务器上的数据集的所在位置
const datasetPath = path.join(baseUrl, 'backend/dataset/train2017.zip')
// 拿到数据集，解压，这个是解压后图片存储的目录路径
const savedZipPath = path.join(__dirname, 'zip')
const imgsUnzipPath = path.join(__dirname, 'images')

// 检查文件夹是否为空
function isFolderEmpty(folderPath) {
  return fs.existsSync(folderPath) && fs.readdirSync(folderPath).length === 0
}

// 现在是模拟远程的服务器，所以需要先下载，下载完成以后再解压，然后返回给客户端
// 从fromPath下载，下载到toPath
async function downloadZip(fromPath, toPath) {
  // 如果路径不存在，需要创建路径
  if (!fs.existsSync(toPath)) {
    console.log('路径不存在，创建路径', toPath)
    fs.mkdirSync(toPath, { recursive: true })
  }

  // 路径下存在文件，就不需要下载了，直接return
  if (fs.readdirSync(toPath).length !== 0) {
    console.log('图片数据已经存在，终止下载')
    return
  }

  // 开始下载
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(toPath)
    console.log(111)
    http
      .get(fromPath, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`))
          return
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log('压缩包下载完成')
          resolve() //收到执行resolve(),更改promise状态
        })
      })
      .on('error', (error) => {
        fs.unlink(toPath, () => reject(error))
      })
  })
}

// 解压函数,直接在toPath下面解压
async function extractZip(toPath) {
  if (!fs.existsSync(toPath)) {
    console.log('路径不存在，创建路径', toPath)
    fs.mkdirSync(toPath, { recursive: true })
  }

  if (isFolderEmpty(toPath)) {
    // toPath下面是空的
    await downloadZip(fromPath, toPath)
  }

  // 不为空，开始解压 ZIP 文件到 images 文件夹
  await fs
    .createReadStream(toPath)
    .pipe(unzipper.Extract({ path: toPath }))
    .promise()
}

// 获取图片列表的接口
app.get('/api/v1/images', async (req, res) => {
  try {
    await ensureImagesExtracted()
    const files = fs
      .readdirSync(imagesFolderPath)
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
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve images',
      error: error.message,
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
