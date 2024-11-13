// 前端请求资源，后端处理完以后再返回给前端，前端直接拿到数据就能用
// 访问这个接口，进行一系列处理，返回前端需要的资源
const http = require('http')
const fs = require('fs')
const path = require('path')
const express = require('express')
const decompress = require('decompress')

// 服务器上的数据集压缩包路径, 中间要加/
const datasetPath = path.join(__dirname, '/dataset/train2017.zip')
// 获取该路径的文件名称，不含后缀
const fileName = path.basename(datasetPath, path.extname(datasetPath)) //train2017

// 拿到数据集，解压，这个是解压后图片存储的目录路径
const extractDirPath = path.join(__dirname, '/extracted', fileName)

// 检查文件夹是否为空
function isFolderEmpty(folderPath) {
  return fs.existsSync(folderPath) && fs.readdirSync(folderPath).length === 0
}

// 直接解压
// 1. 原压缩文件是否存在，如果不存在原文件，直接
// 2. 解压的路径是否存在
// 3. 之前有没有解压过

const app = express()
const PORT = 3000

async function extractZip(fromPath, toPath) {
  await decompress(fromPath, toPath)
  console.log('文件解压完成')
}

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

// 设置静态文件服务
app.use('/images', express.static(extractDirPath))

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
