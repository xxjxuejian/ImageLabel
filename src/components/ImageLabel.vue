<template>
  <div class="image-label">
    <div class="group">
      <span>当前组：</span>
      <div v-for="item in groupCount" :key="item">
        <button
          class="img-change"
          @click="changeGroup(item)"
          :class="curGroup === item ? 'active' : ''"
        >
          第{{ item }}组
        </button>
      </div>
    </div>
    <div class="wrapper">
      <canvas
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
        @mousedown="startDrawing"
        @mousemove="drawRectangle"
        @mouseup="finishDrawing"
        @mouseout="handleMouseOut"
      ></canvas>
      <div class="controls">
        <div class="status">
          <span>标注状态:</span>
          <button :class="{ active: markStatus === 1 }" @click="changeType(1)">全部</button>
          <button :class="{ active: markStatus === 2 }" @click="changeType(2)">未标注</button>
          <button :class="{ active: markStatus === 3 }" @click="changeType(3)">已标注</button>
        </div>
        <div class="number">
          <span>图片数量</span>
          <div>{{ curImgIndex + 1 }} / {{ curGroupPath.length }}</div>
        </div>
        <div class="quality">
          <label>图片质量分数:</label>
          <input v-model="curImgInfo.imgQuality" type="number" min="1" max="5" placeholder="5" />
        </div>
        <div class="btns">
          <button @click="handlePrevClick" ref="prevBtnRef" :disabled="curImgIndex <= 0">
            上一张
          </button>
          <button
            @click="handleNextClick"
            ref="nextBtnRef"
            :disabled="curImgIndex >= curGroupPath.length - 1"
          >
            <!-- {{ curImgIndex === curGroupPath.length - 1 ? '保存' : '下一张' }} -->
            下一张
          </button>
          <!-- <button @click="save">导出至本地</button> -->
          <button @click="save">保存全部</button>
        </div>
      </div>
    </div>

    <div v-if="showCategoryInput" class="dialog">
      <div class="inner">
        <label>请输入类别：</label>
        <input v-model="newCategory" type="text" @input="handleInputEvent" />
        <button @click="confirmCategory">确定</button>
        <button @click="cancelCategory">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onBeforeMount } from 'vue'

const image = ref(null)

const canvasRef = ref(null)
const prevBtnRef = ref(null)
const nextBtnRef = ref(null)
const canvasWidth = ref(800) // 设置 Canvas 宽度
const canvasHeight = ref(600) // 设置 Canvas 高度
const showCategoryInput = ref(false) // 控制是否显示自定义对话框
const newCategory = ref('') // 用于存储用户输入的类别

const allPath = ref([])
const curGroupPath = ref([])
const curImgIndex = ref(0) // 当前组图片的索引
const groupCount = ref(0)
const countPerGroup = 2
const curGroup = ref(1)
const markStatus = ref(1)

const baseUrl = 'http://localhost:3000'
const imageUrl = baseUrl + '/images/'
const CurImgAnnotationsUrl = baseUrl + '/annotations/'
const CurImgQualityUrl = baseUrl + '/quality/'

/*
以哈希表的形式存储每一张图片，图片名称：图片相关信息
{
  '00000001.jpg': {
    imageQuality: 5,
    regions: [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
    ],
  },
}
*/
// 每张图片的各种信息
const allImgsInfo = new Map()
// 当前图片的各种信息
const curImgInfo = ref({
  imgQuality: 5,
  annotations: [],
})
// 获取图片列表
async function getImageList() {
  try {
    const response = await fetch(baseUrl + '/images', {
      method: 'GET',
    })

    console.log('response', response)
    if (response.ok) {
      const data = await response.json()
      console.log('data', data)

      allPath.value = data.map((item) => {
        return {
          path: imageUrl + item.name,
          status: item.status,
        }
      })
      groupCount.value = Math.ceil(data.length / countPerGroup)
      console.log('groupCount.value', groupCount.value)
      console.log('allPath.value', allPath.value)

      // changeGroup(curGroup.value)
    } else {
      alert('获取图片列表失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
  }
}

// 每次重载图片时，重新设置canvas的宽度和高度
function initCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      canvasWidth.value = img.width
      canvasHeight.height = img.height
      console.log('canvas重置完成')
      resolve(img)
    }
    console.log('加载图片', src)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
  })
}
// 获取当前图片的质量分数
async function getCurImgQuality(filename) {
  const res = await fetch(CurImgQualityUrl + filename)
  const data = await res.json()
  console.log('获取当前图片的质量分数', data)
  return data.quality
}

// 获取当前图片的标注数据
async function getCurImgRegions(filename) {
  const res = await fetch(CurImgAnnotationsUrl + filename)
  const data = await res.json()
  console.log('获取当前图片的标注数据', data)
  return data.annotations
}

// 加载当前图片的各种信息，比如图片质量分数，标注数据等
async function loadCurrentImageInfo() {
  console.log('loadCurrentImage----')
  // 只有curGroupPath有值才能用
  const fileUrl = curGroupPath.value[curImgIndex.value].path //http://localhost:7173/images/000000000025.jpg
  // const fileName = fileUrl.match(/(\d+)\.(jpg|jpeg|png|gif)$/i) //获取文件名，不含后缀
  const fileName = fileUrl.match(/\d+\.(jpg|jpeg|png|gif)$/i)[0]

  // 首先从anotations中获取，如果没有，就从服务器获取
  if (allImgsInfo.get(fileName) === undefined) {
    let ano = (await getCurImgRegions(fileName)) || []
    let quality = (await getCurImgQuality(fileName)) || 5
    allImgsInfo.set(fileName, { imgQuality: Number(quality), annotations: ano })
  }
  curImgInfo.value = allImgsInfo.get(fileName)
  console.log('curImgInfo.', curImgInfo.value)

  image.value = await initCanvas(fileUrl)
  draw(curImgInfo.value)
  // 绘制图片与该图片的标注区域
  // try {
  // } catch (error) {
  //   console.error(error)
  // }
}

// 切换组,就是切片，重新从allpath中截取一部分，赋值给curGroupPath，同时重置当前组的索引
const changeGroup = (group) => {
  curGroup.value = group
  curImgIndex.value = 0
  curGroupPath.value = allPath.value.slice((group - 1) * countPerGroup, group * countPerGroup)
  console.log('curGroupPath.value', curGroupPath.value)
  loadCurrentImageInfo()
}

// 鼠标的绘制状态
const drawingState = reactive({
  isDrawing: false,
  startX: 0,
  startY: 0,
})
const currentRect = ref(null) // 当前正在绘制的矩形区域

//绘制图片和所有的矩形区域
const draw = (curImgInfo) => {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (canvas && ctx && image.value) {
    // 绘制图片
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image.value, 0, 0, canvas.width, canvas.height)

    console.log('绘制图片数据', curImgInfo)
    curImgInfo.annotations.forEach((region) => {
      drawRectangleWithLabel(ctx, region)
    })
  }
}
// 绘制矩形区域和内部的文本
const drawRectangleWithLabel = (ctx, region) => {
  // 绘制矩形区域及类别文本
  ctx.beginPath()
  ctx.rect(region.startX, region.startY, region.endX - region.startX, region.endY - region.startY)
  ctx.strokeStyle = 'red'
  ctx.lineWidth = 2
  ctx.stroke()

  // 在矩形区域中心绘制类别文本
  const textX = (region.startX + region.endX) / 2
  const textY = (region.startY + region.endY) / 2
  ctx.font = '14px Arial'
  ctx.fillStyle = 'blue'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(region.category, textX, textY)
}
// 开始绘制矩形
const startDrawing = (event) => {
  drawingState.isDrawing = true
  // 暂时没有考虑缩放对坐标的影响
  drawingState.startX = event.offsetX
  drawingState.startY = event.offsetY
  console.log(drawingState.startX)
  console.log(drawingState.startY)
}

// 绘制过程中的矩形
const drawRectangle = (event) => {
  if (!drawingState.isDrawing) return
  drawingState.endX = event.offsetX
  drawingState.endY = event.offsetY

  // 绘制当前图片和当前图片已有矩形区域
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (canvas && ctx && image.value) {
    // 绘制图片
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image.value, 0, 0, canvas.width, canvas.height)

    // console.log('绘制图片数据', curImgInfo.value)
    curImgInfo.value.annotations.forEach((region) => {
      drawRectangleWithLabel(ctx, region)
    })
  }

  // 绘制当前矩形
  ctx.beginPath()
  ctx.rect(
    drawingState.startX,
    drawingState.startY,
    drawingState.endX - drawingState.startX,
    drawingState.endY - drawingState.startY
  )
  ctx.strokeStyle = 'blue'
  ctx.lineWidth = 2
  ctx.stroke()
}

// 完成矩形绘制
const finishDrawing = (event) => {
  if (drawingState.isDrawing) {
    drawingState.isDrawing = false
    const endX = event.offsetX
    const endY = event.offsetY

    // 计算最终的矩形宽度和高度
    const rectWidth = endX - drawingState.startX
    const rectHeight = endY - drawingState.startY

    // 计算矩形中心点
    const centerX = drawingState.startX + rectWidth / 2
    const centerY = drawingState.startY + rectHeight / 2
    // 计算中心点的比例坐标
    const center_x = centerX / image.value.width
    const center_y = centerY / image.value.height
    // 计算矩形与图像的宽高比
    const rectWidthRatio = rectWidth / image.value.width
    const rectHeightRatio = rectHeight / image.value.height

    currentRect.value = {
      startX: drawingState.startX,
      startY: drawingState.startY,
      endX,
      endY,
      center_x,
      center_y,
      rectWidthRatio,
      rectHeightRatio,
      category: '',
    }
    showCategoryInput.value = true
    console.log('矩形', currentRect.value)
  }
}

// 绘制的时候，鼠标移出canvas，结束绘制
const handleMouseOut = () => {
  if (drawingState.isDrawing) {
    drawingState.isDrawing = false
    draw(curImgInfo.value)
  }
}

// 替换newCategory中的空格
const handleInputEvent = () => {
  // 去除输入框中的所有空格
  newCategory.value = newCategory.value.replace(/\s+/g, '')
}
// 确认类别
const confirmCategory = () => {
  // newCategory 点击确定，就不能为空
  if (newCategory.value === '') {
    alert('类别不能为空')
    return
  }
  if (currentRect.value) {
    currentRect.value.category = newCategory.value
    curImgInfo.value.annotations.push({ ...currentRect.value })

    const fileName =
      curGroupPath.value[curImgIndex.value].path.match(/\d+\.(jpg|jpeg|png|gif)$/i)[0]
    console.log(fileName)
    allImgsInfo.set(fileName, curImgInfo.value)

    currentRect.value = null
    draw(curImgInfo.value) // 更新画布
  }
  newCategory.value = ''
  showCategoryInput.value = false

  // console.log(annotations.data[curImgIndex.value])
}

// 取消类别输入
const cancelCategory = () => {
  currentRect.value = null
  showCategoryInput.value = false
  draw(curImgInfo.value) // 更新画布
  // console.log(annotations.data[curImgIndex.value])
}

// 上一张
const handlePrevClick = () => {
  // saveTxt()
  curImgIndex.value -= 1
  if (curImgIndex.value <= 0) {
    curImgIndex.value = 0
  }
  loadCurrentImageInfo()
}

// 下一张
const handleNextClick = () => {
  // 下一张之前保存当前的信息
  // saveTxt()
  if (curImgIndex.value < curGroupPath.value.length - 1) {
    curImgIndex.value += 1
    loadCurrentImageInfo()
  }
}

// 还需要一个保存标注状态的接口
// 切换标注状态
const changeType = (statusCode) => {
  // 状态就前端保存，最开始
  // 修改的是curGroupPath数组
  curGroupPath.value
}

// 保存/更新 当前图片的质量分数到服务器
const saveCurImgQuality = async (imageName, imgQuality) => {
  try {
    const response = await fetch(baseUrl + '/quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageName, quality: imgQuality }),
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }
    const data = await response.json()
    console.log(data.message)
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }
}

// 保存/更新 当前图片的标注数据到服务器}
const saveCurImgAnnotations = async (imageName, annotations) => {
  try {
    const response = await fetch(baseUrl + `/annotations/${imageName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageName, annotations }),
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const result = await response.json()
    console.log(result.message) // 输出 “标注数据保存成功”
  } catch (error) {
    console.error('请求出错:', error)
  }
}

const saveTxt = async () => {
  console.log(annotations.data)
  console.log(curImgIndex.value)
  // 保存当前图片的标注信息
  const curData = annotations.data[curImgIndex.value]
  console.log(curData)

  curData.regions.forEach((region) => {
    region.value =
      region.category +
      ' ' +
      region.center_x +
      ' ' +
      region.center_y +
      ' ' +
      region.rectWidthRatio +
      ' ' +
      region.rectHeightRatio
  })

  // console.log(curData.regions);

  const imgName = imgPath.value[curImgIndex.value].name

  const txt = JSON.stringify(curData.regions)
  const fileName = imgName.split('.')[0]

  console.log(txt)
  console.log(fileName)

  await createTXT(fileName, txt)

  const newRecord = {
    image_name: imgName,
    quality: curData.imgQuality,
  }

  await addRecord(newRecord)

  console.log(fileName)
  allPath.value.forEach((item) => {
    if (item.name === imgName) {
      console.log(item)
      item.status = true
    }
  })

  console.log(annotations.data[curImgIndex.value])
}

// 创建文本文件
const createTXT = async (fileName, txt) => {
  try {
    const response = await fetch(baseUrl + '/create-txt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: txt, fileName: fileName + '.txt' }),
    })

    if (response.ok) {
      const result = await response.text()
      console.log(result)
      console.log(annotations.data[curImgIndex.value])
    } else {
      alert('创建文件失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }
}

const save = async () => {
  try {
    const response = await fetch(baseUrl + '/download-zip', {
      method: 'GET',
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'archive.zip'
      a.click()
    } else {
      alert('导出失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }

  console.log(annotations.data[curImgIndex.value].regions)
}

const deleteCategory = (index) => {
  // 删除当前图片的指定标签
  const curData = annotations.data[curImgIndex.value]
  curData.regions = curData.regions.filter((region) => region !== index)
  draw() // 更新画布
}
async function main() {
  await getImageList()
  changeGroup(curGroup.value)
}
main()
</script>

<style scoped lang="less">
.image-label {
  width: 100%;
  height: 100%;
  //   background-color: rebeccapurple;
  .group {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 40px;
  }
  .img-change {
    margin-left: 5px;
  }
  .active {
    color: #f00;
  }

  .wrapper {
    // background-color: aquamarine;
    display: flex;
    justify-content: center;

    canvas {
      cursor: crosshair;
    }

    .controls {
      width: 300px;
      padding: 10px;

      .status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .number {
        display: flex;
        margin-bottom: 10px;
        justify-content: space-between;
      }

      .quality {
        display: flex;
        margin-bottom: 10px;

        input {
          flex: 1;
          margin-left: 5px;
        }
      }
      .btns {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .category-list {
        .category-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          .category-delete {
            cursor: pointer;
            color: #f00;
            margin-left: 5px;
            font-size: 20px;
          }
        }
      }
    }
  }
}

.dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.3);

  .inner {
    width: 400px;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;

    input:focus {
      outline: none;
    }
    button {
      padding: 3px;
    }
  }
}
</style>
