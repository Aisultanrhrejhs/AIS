import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'

const root = path.dirname(fileURLToPath(import.meta.url))
const storagePath = path.join(root, 'storage', 'videos')
const catalogPath = path.join(root, 'storage', 'catalog.json')
const distPath = path.join(root, 'dist')
const port = Number(process.env.PORT || 3001)
const idPattern = /^[0-9a-f-]{36}$/i

await mkdir(storagePath, { recursive: true })
let videos = []
try {
  videos = JSON.parse(await readFile(catalogPath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

let persistQueue = Promise.resolve()
function persistCatalog() {
  const snapshot = JSON.stringify(videos, null, 2)
  const temporaryPath = `${catalogPath}.${randomUUID()}.tmp`
  persistQueue = persistQueue.catch(() => {}).then(async () => {
    await writeFile(temporaryPath, snapshot, 'utf8')
    await rename(temporaryPath, catalogPath)
  })
  return persistQueue
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, storagePath),
    filename: (request, file, callback) => {
      request.videoId = randomUUID()
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12)
      callback(null, `${request.videoId}${extension}`)
    },
  }),
  limits: { fileSize: 20 * 1024 ** 3, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith('video/')) return callback(new Error('Можно загружать только видеофайлы.'))
    callback(null, true)
  },
})

const app = express()
app.disable('x-powered-by')
app.get('/api/videos', (_request, response) => {
  response.json([...videos].sort((first, second) => second.createdAt.localeCompare(first.createdAt)))
})

app.post('/api/videos', upload.single('video'), async (request, response, next) => {
  if (!request.file) return response.status(400).json({ error: 'Не выбран видеофайл.' })
  const title = typeof request.body.title === 'string' ? request.body.title.trim().slice(0, 120) : ''
  const entry = {
    id: request.videoId,
    title: title || path.parse(request.file.originalname).name.slice(0, 120) || 'Видео без названия',
    filename: request.file.originalname,
    size: request.file.size,
    mimeType: request.file.mimetype,
    createdAt: new Date().toISOString(),
    category: typeof request.body.category === 'string' ? request.body.category.slice(0, 32) : 'Other',
    author: typeof request.body.author === 'string' ? request.body.author.trim().slice(0, 32) : 'ЛОКАЛЬНЫЙ АРХИВ',
    owner: typeof request.body.owner === 'string' ? request.body.owner.trim().slice(0, 160) : '',
    description: typeof request.body.description === 'string' ? request.body.description.trim().slice(0, 2000) : '',
  }
  videos.push(entry)
  try {
    await persistCatalog()
    response.status(201).json(entry)
  } catch (error) {
    videos = videos.filter((video) => video.id !== entry.id)
    await unlink(request.file.path).catch(() => {})
    next(error)
  }
})

app.get('/api/videos/:id/file', (request, response, next) => {
  if (!idPattern.test(request.params.id)) return response.sendStatus(404)
  const video = videos.find((entry) => entry.id === request.params.id)
  if (!video) return response.sendStatus(404)
  const extension = path.extname(video.filename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12)
  response.sendFile(path.join(storagePath, `${video.id}${extension}`), (error) => {
    if (error && !response.headersSent) next(error)
  })
})

app.delete('/api/videos/:id', async (request, response, next) => {
  if (!idPattern.test(request.params.id)) return response.sendStatus(404)
  const video = videos.find((entry) => entry.id === request.params.id)
  if (!video) return response.sendStatus(404)
  const extension = path.extname(video.filename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12)
  try {
    await unlink(path.join(storagePath, `${video.id}${extension}`))
    videos = videos.filter((entry) => entry.id !== video.id)
    await persistCatalog()
    response.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/', (_request, response) => response.sendFile(path.join(distPath, 'index.html')))
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return response.status(status).json({ error: status === 413 ? 'Файл превышает лимит 20 ГБ.' : 'Не удалось принять файл.' })
  }
  if (error.message === 'Можно загружать только видеофайлы.') return response.status(415).json({ error: error.message })
  console.error(error)
  response.status(500).json({ error: 'Внутренняя ошибка сервера.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Кадр доступен на http://localhost:${port}`)
})