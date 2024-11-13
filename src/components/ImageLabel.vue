<template>
  <div class="image-label">
    <div class="title">
      <label for="img-label">图片列表</label>
      <div v-for="(n, index) in Array(totalPage)" :key="index">
        <button
          class="img-change"
          @click="changePage(index + 1)"
          :class="curPage === index + 1 ? 'active' : ''"
        >
          {{ index * 100 + 1 }} - {{ index * 100 + 100 }}
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
        <div class="img-info">
          <button class="img-change" :class="curType === 1 ? 'active' : ''" @click="changeType(1)">
            全部
          </button>
          <button class="img-change" :class="curType === 2 ? 'active' : ''" @click="changeType(2)">
            未评价
          </button>
          <button class="img-change" :class="curType === 3 ? 'active' : ''" @click="changeType(3)">
            已评价
          </button>
        </div>
        <div class="number">
          <div>图片数量</div>
          <div>{{ curImgIndex + 1 }}/{{ imgPath.length }}</div>
        </div>
        <div class="quality">
          <label>图片质量分数:</label>
          <input
            v-if="annotations.data.length"
            v-model="annotations.data[curImgIndex].imgQuality"
            type="number"
            min="1"
            max="5"
            placeholder="5"
          />
        </div>
        <div class="btns">
          <button @click="handlePrevClick" ref="prevBtnRef" :disabled="curImgIndex <= 0">
            上一张
          </button>
          <button @click="handleNextClick" ref="nextBtnRef">
            {{ curImgIndex === imgPath.length - 1 ? '保存' : '下一张' }}
          </button>
          <button @click="save">导出</button>
        </div>

        <div class="category-list" v-if="annotations.data.length">
          <label>标签列表</label>
          <div
            v-for="(item, index) in annotations.data[curImgIndex].regions"
            :key="index"
            class="category-item"
          >
            <div class="category-name">类别： {{ item.category }}</div>
            <div class="category-delete" @click="deleteCategory(item)">x</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义对话框，用于输入类别 -->
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
import { ref, onMounted, reactive, onBeforeMount } from 'vue'

const image = ref(null)
const curImgIndex = ref(0) // 当前图片的索引
const canvasRef = ref(null)
const prevBtnRef = ref(null)
const nextBtnRef = ref(null)
const canvasWidth = ref(800) // 设置 Canvas 宽度
const canvasHeight = ref(600) // 设置 Canvas 高度
const showCategoryInput = ref(false) // 控制是否显示自定义对话框
const newCategory = ref('') // 用于存储用户输入的类别

const allPath = ref([])
const imgPath = ref([])
const totalPage = ref(0)
const curPage = ref(1)
const curType = ref(1)

// const baseUrl = 'http://localhost:7173'
const baseUrl = 'http://192.168.1.251:7173'

// 获取图片列表
const getImageList = async () => {
  try {
    const response = await fetch(baseUrl + '/list-images', {
      method: 'GET',
    })

    if (response.ok) {
      allPath.value = []
      const data = await response.json()
      console.log('data', data.list)
      totalPage.value = Math.ceil(data.list.length / 100)

      data.list.forEach((item) => {
        allPath.value.push(item)
      })
      changePage(1)
      // imgPath.value = allPath.value.slice(0, 100)
      // console.log('imgPath', imgPath.value)
      // annotations.data = imgPath.value.map(() => ({
      //   imgQuality: 5, // 默认质量评分
      //   regions: [], // 每张图片的矩形区域标注
      // }))
      // console.log('annotations.data', annotations.data)
      // loadCurrentImage()
    } else {
      alert('获取图片列表失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }

  // 获取服务器上的压缩文件
  // const response = await fetch('http://localhost:5173/train2017.zip')
  // const response = await fetch('train2017.zip')
  // if (!response.ok) {
  //   throw new Error('Failed to fetch the zip file.')
  // }
  // console.log('response', response)
  // const zipData = await response.arrayBuffer()
  // console.log('zipData', zipData)

  // const zip = await JSZip.loadAsync(zipData)
  // console.log('zip', zip)

  // const imagePaths = []
  // zip.forEach((relativePath, file) => {
  //   if (!file.dir && isImageFile(relativePath)) {
  //     imagePaths.push(relativePath)
  //   }
  // })

  // console.log('imagePaths', imagePaths)

  // imgPath.value = await Promise.all(
  //   imagePaths.map(async (path) => {
  //     const file = await zip.file(path).async('base64')
  //     const dataUrl = `data:image/${getFileExtension(path)};base64,${file}`
  //     return Promise.resolve({
  //       fileName: path, // 文件名
  //       dataUrl: dataUrl, // base64 编码的图片数据
  //     })
  //   })
  // )
  // console.log('imgPath.value', imgPath.value)

  // annotations.data = imgPath.value.map(() => ({
  //   imgQuality: 5, // 默认质量评分
  //   regions: [], // 每张图片的矩形区域标注
  // }))
  // console.log('annotations.data', annotations.data)
  // loadCurrentImage()
}

// 判断是否为图片文件
const isImageFile = (filename) => {
  const extension = getFileExtension(filename).toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif'].includes(extension)
}

// 获取文件后缀
const getFileExtension = (filename) => {
  return filename.split('.').pop()
}

// 切换页码
const changePage = (page) => {
  curPage.value = page
  getImages()
}

// 切换图片类型
const changeType = (type) => {
  curType.value = type
  getImages()
}
// 获取图片列表
const getImages = async () => {
  curImgIndex.value = 0
  const page = curPage.value
  imgPath.value = allPath.value.slice((page - 1) * 100, page * 100)
  if (curType.value === 2) {
    imgPath.value = imgPath.value.filter((item) => !item.status)
  }
  if (curType.value === 3) {
    imgPath.value = imgPath.value.filter((item) => item.status)
  }

  annotations.data = imgPath.value.map(() => ({
    imgQuality: 5, // 默认质量评分
    regions: [], // 每张图片的矩形区域标注
  }))
  console.log('annotations.data', annotations.data)
  loadCurrentImage()
}

// annotations 是所有图片的数据信息，其中每一项是一张图片的标注数据，包含矩形区域、图片质量等信息
const annotations = reactive({
  data: [],
})

// 每一个矩形绘制状态以及矩形所属类别，其它信息等
const drawingState = reactive({
  isDrawing: false,
  startX: 0,
  startY: 0,
})
const currentRect = ref(null) // 当前正在绘制的矩形区域
// 加载图片
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      canvasWidth.value = img.width
      canvasHeight.value.height = img.height
      resolve(img)
    }
    console.log('加载图片', src)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
  })
}

const loadCurrentImage = async () => {
  try {
    const imgPathValue = imgPath.value[curImgIndex.value].name
    const response = await fetch(baseUrl + '/images/' + imgPathValue, {
      method: 'GET',
    })

    const data = await response.blob()
    console.log('data', data)
    const dataUrl = URL.createObjectURL(data)
    // image.value = await loadImage(dataUrl)
    // draw()

    image.value = await loadImage(dataUrl)
    await getImageDate(imgPathValue)

    // 图片加载完成，绘制出来
    draw()
  } catch (error) {
    console.error(error)
  }
}

const getImageDate = async (fileName) => {
  // 获取当前图片的标注数据
  try {
    const response = await fetch(baseUrl + '/get-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: fileName }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('result', result)

      if (result.content) {
        annotations.data[curImgIndex.value].regions = []
        const list = result.content.split('\r\n')
        list.pop()
        console.log('获取数据', list)
        list.forEach((item) => {
          const [category, center_x, center_y, rectWidthRatio, rectHeightRatio] = item.split(' ')
          const endX = (parseFloat(center_x) + parseFloat(rectWidthRatio) / 2) * image.value.width
          const endY = (parseFloat(center_y) + parseFloat(rectHeightRatio) / 2) * image.value.height
          const startX = (parseFloat(center_x) - parseFloat(rectWidthRatio) / 2) * image.value.width
          const startY =
            (parseFloat(center_y) - parseFloat(rectHeightRatio) / 2) * image.value.height
          currentRect.value = {
            center_x: parseFloat(center_x),
            center_y: parseFloat(center_y),
            rectWidthRatio: parseFloat(rectWidthRatio),
            rectHeightRatio: parseFloat(rectHeightRatio),
            category: category,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
          }

          console.log('currentRect', currentRect.value)
          annotations.data[curImgIndex.value].regions.push({ ...currentRect.value })
        })
      }
      // alert(result);
    } else {
      alert('获取图片信息失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }

  try {
    const response = await fetch(baseUrl + '/get-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: fileName }),
    })

    if (response.ok) {
      const result = await response.text()
      if (result.record) {
        annotations.data[curImgIndex.value].imgQuality = result.record
      }

      // alert(result);
    } else {
      alert('获取图片信息失败')
    }
  } catch (error) {
    console.error('请求失败:', error)
    alert('请求失败')
  }

  console.log('获取数据', annotations.data[curImgIndex.value])
}

//绘制图片和所有的矩形区域
const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (canvas && ctx && image.value) {
    // 绘制图片
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image.value, 0, 0, canvas.width, canvas.height)

    console.log('绘制图片数据', annotations.data[curImgIndex.value])
    annotations.data[curImgIndex.value].regions.forEach((region) => {
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
  const rect = canvasRef.value.getBoundingClientRect()
  drawingState.endX = event.clientX - rect.left
  drawingState.endY = event.clientY - rect.top

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height) // 清空画布
  ctx.drawImage(image.value, 0, 0, canvas.width, canvas.height) // 重绘图片

  // 绘制已有矩形区域
  annotations.data[curImgIndex.value].regions.forEach((region) => {
    drawRectangleWithLabel(ctx, region)
  })

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
    const rect = canvasRef.value.getBoundingClientRect()
    const endX = event.clientX - rect.left
    const endY = event.clientY - rect.top

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
  }
}

// 绘制的时候，鼠标移出canvas，结束绘制
const handleMouseOut = () => {
  if (drawingState.isDrawing) {
    drawingState.isDrawing = false
    draw()
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
    annotations.data[curImgIndex.value].regions.push({ ...currentRect.value })
    currentRect.value = null
    draw() // 更新画布
  }
  newCategory.value = ''
  showCategoryInput.value = false

  console.log(annotations.data[curImgIndex.value])
}

// 取消类别输入
const cancelCategory = () => {
  currentRect.value = null
  showCategoryInput.value = false
  draw() // 更新画布
  console.log(annotations.data[curImgIndex.value])
}

const handlePrevClick = () => {
  saveTxt()
  curImgIndex.value -= 1
  if (curImgIndex.value <= 0) {
    curImgIndex.value = 0
  }
  loadCurrentImage()
  console.log(annotations.data[curImgIndex.value])
}

const handleNextClick = () => {
  // 下一张之前保存当前的信息
  saveTxt()
  if (curImgIndex.value < imgPath.value.length - 1) {
    curImgIndex.value += 1
    loadCurrentImage()
    console.log(annotations.data[curImgIndex.value])
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
    // 删除不需要的字段
    // delete region.startX
    // delete region.startY
    // delete region.endX
    // delete region.endY
    // delete region.center_x
    // delete region.center_y
    // delete region.rectWidthRatio
    // delete region.rectHeightRatio
    // delete region.category
  })

  // console.log(curData.regions);

  const txt = JSON.stringify(curData.regions)
  const fileName = imgPath.value[curImgIndex.value].name.split('.')[0]

  console.log(txt)
  console.log(fileName)

  await createTXT(fileName, txt)

  const newRecord = {
    image_name: imgPath.value[curImgIndex.value].name,
    quality: curData.imgQuality,
  }

  await addRecord(newRecord)

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

// csv 文件添加记录
const addRecord = async (newRecord) => {
  try {
    const response = await fetch(baseUrl + '/add-record-to-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newRecord }),
    })

    if (response.ok) {
      const result = await response.text()
      console.log(annotations.data[curImgIndex.value])
      // alert(result);
    } else {
      alert('添加记录失败')
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

onMounted(() => {
  // loadCurrentImage();
})

onBeforeMount(() => {
  getImageList()
})
</script>

<style scoped lang="less">
.image-label {
  width: 100%;
  height: 100%;
  //   background-color: rebeccapurple;
  .title {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
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
      width: 200px;
      padding: 10px;

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
