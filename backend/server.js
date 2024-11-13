// 本地模拟
import http from 'http'
import fs from 'fs'
import path from 'path'
import express from 'express'
import { fileURLToPath } from 'url'

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
const imgsUnzipPath = path.join(__dirname, 'images')

// 现在是模拟远程的服务器，所以需要先下载，下载完成以后再解压，然后返回给客户端
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
