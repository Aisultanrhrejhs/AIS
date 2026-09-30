import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Activity, ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronDown, Clapperboard, Clock3, Flame, FileVideo, Gauge, HardDrive, History, LayoutDashboard, LoaderCircle, LogIn, LogOut, MessageSquareWarning, Play, Plus, Radio, Search, Send, Share2, Sparkles, ThumbsDown, ThumbsUp, Trash2, Upload, UserPlus, UserRound, X } from 'lucide-react'
import './App.css'

type VideoEntry = { id: string; title: string; filename: string; size: number; mimeType: string; createdAt: string; category?: string; author?: string; owner?: string; description?: string }
type Page = 'Home' | 'Trending' | 'Subscriptions' | 'History' | 'Saved' | 'My Videos' | 'Profile' | 'Channel' | 'Upload' | 'Admin' | 'Video'
type User = { email: string; username: string; name: string }
type Profile = { username: string; name: string; about: string; avatar: string; cover: string; backgroundColor: string }
type Comment = { id: string; name: string; text: string; createdAt: string; likes: number }
type Reaction = 'like' | 'dislike' | null
type Account = { email: string; username?: string; name: string; passwordHash: string }
const categories = ['All', 'Music', 'Tech', 'Science', 'Art', 'Lifestyle', 'Other']
const categoryNames: Record<string, string> = { All: 'Все', Music: 'Музыка', Tech: 'Технологии', Science: 'Наука', Art: 'Искусство', Lifestyle: 'Образ жизни', Other: 'Другое' }
const pageNames: Record<Page, string> = { Home: 'Главная', Trending: 'В тренде', Subscriptions: 'Подписки', History: 'История', Saved: 'Сохранённое', 'My Videos': 'Мои видео', Profile: 'Каналы', Channel: 'Канал', Upload: 'Загрузка', Admin: 'Администрирование', Video: 'Видео' }
const adminTabNames: Record<'Activity' | 'Users' | 'Videos' | 'Reports', string> = { Activity: 'События', Users: 'Пользователи', Videos: 'Видео', Reports: 'Жалобы' }
const fileUrl = (id: string) => `/api/videos/${encodeURIComponent(id)}/file`
const storageKey = (key: string) => `minitube:${key}`
const readStore = <T,>(key: string, fallback: T): T => {
  try {
    const rawValue = window.localStorage.getItem(storageKey(key))
    if (rawValue === null || rawValue === 'undefined' || rawValue === 'null') return fallback
    const parsed = JSON.parse(rawValue) as T
    return parsed ?? fallback
  } catch {
    try { window.localStorage.removeItem(storageKey(key)) } catch { /* ignore cleanup errors */ }
    return fallback
  }
}
const writeStore = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    try { window.localStorage.removeItem(storageKey(key)) } catch { /* ignore cleanup errors */ }
  }
}
const formatSize = (bytes: number) => bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} МБ` : `${(bytes / 1024 ** 3).toFixed(1)} ГБ`
const pluralize = (count: number, one: string, few: string, many: string) => { const mod100 = count % 100; const mod10 = count % 10; return mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many }
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Недавно' : new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) }
const formatTime = (seconds: number) => { if (!Number.isFinite(seconds)) return '0:00'; const min = Math.floor(seconds / 60); return `${min}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` }
const initials = (name: string) => name.trim().slice(0, 1).toLocaleUpperCase('ru') || 'M'

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const globalSearchRef = useRef<HTMLInputElement>(null)
  const playerRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [page, setPage] = useState<Page>('Home')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<User | null>(() => { const session = readStore<Partial<User> | null>('session', null); return session ? { email: session.email || '', username: session.username || 'Aisultanrhrejhs', name: 'aisultan' } : null })
  const [profile, setProfile] = useState<Profile>(() => { const stored = readStore<Partial<Profile>>('profile', {}); return { username: 'Aisultanrhrejhs', name: 'aisultan', about: stored.about || 'Передаю сигнал из своей видеотеки.', avatar: stored.avatar || '', cover: stored.cover || '', backgroundColor: stored.backgroundColor || '#121212' } })
  const [reactions, setReactions] = useState<Record<string, Reaction>>(() => readStore('reactions', {}))
  const [saved, setSaved] = useState<string[]>(() => readStore('saved', []))
  const [subscriptions, setSubscriptions] = useState<string[]>(() => readStore('subscriptions', []))
  const [history, setHistory] = useState<string[]>(() => readStore('history', []))
  const [views, setViews] = useState<Record<string, number>>(() => readStore('views', {}))
  const [comments, setComments] = useState<Record<string, Comment[]>>(() => readStore('comments', {}))
  const [reports, setReports] = useState<string[]>(() => readStore('reports', []))
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [playerTime, setPlayerTime] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [visibleCount, setVisibleCount] = useState(8)
  const [adminTab, setAdminTab] = useState<'Activity' | 'Users' | 'Videos' | 'Reports'>('Activity')
  const [adminSearch, setAdminSearch] = useState('')
  const [notice, setNotice] = useState('')

  const currentUserVideos = useMemo(() => {
    if (!user) return []
    return videos.filter((video) => !video.owner || video.owner === user.email)
  }, [videos, user])
  const selectedVideo = videos.find((video) => video.id === selectedId) ?? null
  const totalSize = currentUserVideos.reduce((sum, video) => sum + video.size, 0)
  const currentAuthor = (video: VideoEntry) => video.author || 'ЛОКАЛЬНЫЙ АРХИВ'
  const filteredVideos = useMemo(() => {
    let list = [...currentUserVideos]
    const search = query.trim().toLocaleLowerCase('ru')
    if (!user) return []
    if (page === 'Trending') list.sort((a, b) => (views[b.id] ?? 0) - (views[a.id] ?? 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    if (page === 'Subscriptions') list = list.filter((video) => subscriptions.includes(currentAuthor(video)))
    if (page === 'History') list = history.map((id) => list.find((video) => video.id === id)).filter((video): video is VideoEntry => Boolean(video))
    if (page === 'Saved') list = list.filter((video) => saved.includes(video.id))
    if (page === 'My Videos') list = list.filter((video) => !video.owner || video.owner === user.email)
    if (category !== 'All') list = list.filter((video) => (video.category || 'Other') === category)
    if (search) list = list.filter((video) => `${video.title} ${currentAuthor(video)} ${video.category ?? ''} ${video.description ?? ''}`.toLocaleLowerCase('ru').includes(search))
    return list
  }, [currentUserVideos, page, query, category, views, subscriptions, history, saved, user])

  useEffect(() => {
    let active = true
    fetch('/api/videos').then(async (response) => {
      if (!response.ok) throw new Error('Не удалось получить каталог')
      return await response.json() as VideoEntry[]
    }).then((entries) => {
      if (!active) return
      setVideos(entries)
      setError('')
      const params = new URLSearchParams(window.location.search)
      const sharedId = params.get('video')
      const sharedVideo = entries.find((video) => video.id === sharedId)
      if (sharedVideo) { setSelectedId(sharedVideo.id); setPage('Video') }
      else {
        const channelName = params.get('channel')
        if (channelName) { setSelectedChannel(channelName); setPage('Channel') }
      }
    }).catch(() => {
      if (active) setError('Сервер локального хранилища недоступен. Запустите npm run dev.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => { writeStore('profile', profile) }, [profile])
  useEffect(() => { writeStore('reactions', reactions) }, [reactions])
  useEffect(() => { writeStore('saved', saved) }, [saved])
  useEffect(() => { writeStore('subscriptions', subscriptions) }, [subscriptions])
  useEffect(() => { writeStore('history', history) }, [history])
  useEffect(() => { writeStore('views', views) }, [views])
  useEffect(() => { writeStore('comments', comments) }, [comments])
  useEffect(() => { writeStore('reports', reports) }, [reports])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => { if (playerRef.current) playerRef.current.playbackRate = playbackRate }, [playbackRate, selectedId])
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); globalSearchRef.current?.focus() }
      if (event.key === 'Escape') { setMenuOpen(false); setAuthMode(null) }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || visibleCount >= filteredVideos.length) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setVisibleCount((current) => Math.min(current + 8, filteredVideos.length)) }, { rootMargin: '180px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visibleCount, filteredVideos.length])

  function notify(message: string) { setToast(message) }
  function navigate(next: Page) { setPage(next); setSelectedId(null); setVisibleCount(8); setMenuOpen(false); setError(''); if (next !== 'Video') window.history.replaceState(null, '', window.location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function openVideo(video: VideoEntry) {
    setSelectedId(video.id); setPage('Video'); setPlayerTime(0); setPlaybackRate(1); window.history.replaceState(null, '', `?video=${encodeURIComponent(video.id)}`); setHistory((current) => [video.id, ...current.filter((id) => id !== video.id)]); setViews((current) => ({ ...current, [video.id]: (current[video.id] ?? 0) + 1 })); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openChannel(author: string) {
    if (user && (author === profile.name || author === user.name)) { navigate('Profile'); return }
    setSelectedChannel(author)
    setPage('Channel')
    setSelectedId(null)
    setMenuOpen(false)
    window.history.replaceState(null, '', `/?channel=${encodeURIComponent(author)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function toggleReaction(id: string, reaction: Exclude<Reaction, null>) {
    if (!user) { setAuthMode('login'); return }
    setReactions((current) => ({ ...current, [id]: current[id] === reaction ? null : reaction }))
  }
  function toggleSaved(id: string) {
    if (!user) { setAuthMode('login'); return }
    const isSaved = saved.includes(id)
    setSaved((current) => isSaved ? current.filter((item) => item !== id) : [...current, id])
    notify(isSaved ? 'Удалено из сохранённых' : 'Добавлено в сохранённые')
  }
  function toggleSubscription(author: string) {
    if (!user) { setAuthMode('login'); return }
    setSubscriptions((current) => {
      const next = current.includes(author) ? current.filter((item) => item !== author) : [...current, author]
      notify(current.includes(author) ? 'Подписка отменена' : `Вы подписались на ${author}`)
      return next
    })
  }
  async function shareVideo() {
    if (!selectedVideo) return
    const link = `${window.location.origin}/?video=${selectedVideo.id}`
    try { await navigator.clipboard.writeText(link); notify('Ссылка скопирована') } catch { notify(link) }
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) { setAuthMode('login'); return }
    if (!selectedVideo || !commentText.trim()) return
    const item: Comment = { id: crypto.randomUUID(), name: profile.name, text: commentText.trim(), createdAt: new Date().toISOString(), likes: 0 }
    setComments((current) => ({ ...current, [selectedVideo.id]: [item, ...(current[selectedVideo.id] ?? [])] }))
    setCommentText(''); notify('Комментарий опубликован')
  }
  function likeComment(id: string) {
    if (!selectedVideo) return
    setComments((current) => ({ ...current, [selectedVideo.id]: (current[selectedVideo.id] ?? []).map((comment) => comment.id === id ? { ...comment, likes: comment.likes + 1 } : comment) }))
  }
  function reportVideo() {
    if (!selectedVideo) return
    if (reports.includes(selectedVideo.id)) { notify('Жалоба уже отправлена'); return }
    setReports((current) => [...current, selectedVideo.id]); notify('Жалоба отправлена в локальный журнал')
  }

  function setFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('video/')) { setError('Выберите видеофайл.'); notify('Поддерживаются только видеофайлы'); return }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file); setUploadTitle(file.name.replace(/\.[^.]+$/, '')); setPreviewUrl(URL.createObjectURL(file)); setError('')
  }
  function onFileInput(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0]); event.target.value = '' }
  function onDrop(event: DragEvent<HTMLElement>) { event.preventDefault(); setDragging(false); setFile(event.dataTransfer.files[0]); setPage('Upload'); setSelectedId(null) }
  function uploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) { setAuthMode('login'); return }
    if (!selectedFile) { setError('Сначала выберите видеофайл.'); return }
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('video', selectedFile)
    formData.set('author', profile.name)
    formData.set('owner', user.email)
    setUploading(true); setProgress(0); setError('')
    const request = new XMLHttpRequest()
    request.open('POST', '/api/videos')
    request.upload.onprogress = (progressEvent) => { if (progressEvent.lengthComputable) setProgress(Math.round(progressEvent.loaded / progressEvent.total * 100)) }
    request.onload = () => {
      let result: VideoEntry & { error?: string }
      try { result = JSON.parse(request.responseText) as VideoEntry & { error?: string } } catch { result = { error: 'Сервер вернул некорректный ответ' } as VideoEntry & { error: string } }
      if (request.status < 200 || request.status >= 300) { setError(result.error || 'Не удалось загрузить видео'); setUploading(false); return }
      setVideos((current) => [result, ...current.filter((video) => video.id !== result.id)])
      setSelectedFile(null); setUploadTitle(''); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setUploading(false); setProgress(100); form.reset(); setPage('My Videos'); setSelectedId(null); setCategory('All'); setQuery(''); notify('Видео опубликовано в локальной видеотеке')
    }
    request.onerror = () => { setError('Ошибка соединения с сервером.'); setUploading(false) }
    request.send(formData)
  }
  async function deleteVideo(video: VideoEntry) {
    if (!window.confirm(`Удалить «${video.title}» с диска?`)) return
    try {
      const response = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Не удалось удалить файл')
      setVideos((current) => current.filter((item) => item.id !== video.id)); setSaved((current) => current.filter((id) => id !== video.id)); setHistory((current) => current.filter((id) => id !== video.id)); if (selectedId === video.id) navigate('Home'); notify('Видео удалено с диска')
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Ошибка удаления') }
  }
  function logout() { setUser(null); writeStore('session', null); setMenuOpen(false); notify('Вы вышли из аккаунта'); navigate('Home') }

  const shownVideos = filteredVideos.slice(0, visibleCount)
  const signedTotal = Object.values(reactions).filter((value) => value === 'like').length
  const accountList = readStore<Account[]>('accounts', [])

  function VideoCard({ video, index }: { video: VideoEntry; index: number }) {
    const reaction = reactions[video.id]
    const count = (reaction === 'like' ? 1 : 0)
    return <article className={`video-card ${selectedId === video.id ? 'video-card--selected' : ''}`} style={{ animationDelay: `${Math.min(index % 8, 7) * 45}ms` }}>
      <div className="video-thumb" onClick={() => openVideo(video)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') openVideo(video) }}>
        <video src={fileUrl(video.id)} preload="metadata" muted playsInline onMouseEnter={(event) => { void event.currentTarget.play().catch(() => {}) }} onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0 }} onLoadedMetadata={(event) => { const target = event.currentTarget; const duration = formatTime(target.duration); const label = target.parentElement?.querySelector('.duration-tag'); if (label) label.textContent = duration }} />
        <span className={`thumb-scan thumb-scan--${index % 4}`} /><span className="thumb-index">ЗАПИСЬ / {(index + 1).toString().padStart(2, '0')}</span><span className="duration-tag">{video.mimeType.split('/').pop()?.toUpperCase() || 'ВИДЕО'}</span><span className="thumb-play"><Play size={18} fill="currentColor" /></span>
      </div>
      <div className="video-card-body">
        <button className="avatar-small avatar-channel" onClick={() => openChannel(currentAuthor(video))} aria-label={`Открыть канал ${currentAuthor(video)}`} title={`Канал ${currentAuthor(video)}`}>
          {profile.avatar && video.owner === user?.email ? <img src={profile.avatar} alt="" /> : initials(currentAuthor(video))}
        </button>
        <div className="video-card-copy">
          <button className="video-title" onClick={() => openVideo(video)}>{video.title}</button>
          <button className="author-link" onClick={() => openChannel(currentAuthor(video))}>{currentAuthor(video)}</button>
          <div className="video-meta">{(views[video.id] ?? 0).toLocaleString()} {pluralize(views[video.id] ?? 0, 'просмотр', 'просмотра', 'просмотров')} · {formatDate(video.createdAt)}</div>
          <div className="card-actions">
            <button className={`action-chip ${reaction === 'like' ? 'is-active' : ''}`} onClick={() => toggleReaction(video.id, 'like')} aria-label="Нравится"><ThumbsUp size={13} /> {count}</button>
            <button className={`action-chip ${reaction === 'dislike' ? 'is-active' : ''}`} onClick={() => toggleReaction(video.id, 'dislike')} aria-label="Не нравится"><ThumbsDown size={13} /></button>
            <button className={`action-chip save-chip ${saved.includes(video.id) ? 'is-active' : ''}`} onClick={() => toggleSaved(video.id)} aria-label="Сохранить"><Bookmark size={13} /> {saved.includes(video.id) ? 'СОХР.' : 'СОХРАНИТЬ'}</button>
          </div>
        </div>
        <button className="card-more" onClick={() => void deleteVideo(video)} title="Удалить из хранилища"><Trash2 size={15} /></button>
      </div>
    </article>
  }

  function renderGrid(list: VideoEntry[]) {
    if (loading) return <div className="video-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}><div className="skeleton-thumb" /><div className="skeleton-lines"><i /><i /><i /></div></div>)}</div>
    if (!list.length) return <div className="empty-state"><div className="empty-signal"><Clapperboard size={23} /></div><b>{query ? 'СИГНАЛ НЕ НАЙДЕН' : page === 'Subscriptions' ? 'ПОКА НЕТ ПОДПИСОК' : page === 'History' ? 'ИСТОРИЯ ПОКА ПУСТА' : page === 'Saved' ? 'НЕТ СОХРАНЁННЫХ ВИДЕО' : 'В АРХИВЕ ПОКА ТИХО'}</b><span>{query ? 'Измените поисковый запрос или категорию.' : 'Добавьте видео в локальную библиотеку — они появятся здесь.'}</span>{!query && <button className="button-light" onClick={() => user ? navigate('Upload') : setAuthMode('login')}><Plus size={15} /> ДОБАВИТЬ ВИДЕО</button>}</div>
    return <><div className="video-grid">{list.slice(0, visibleCount).map((video, index) => <VideoCard key={video.id} video={video} index={index} />)}</div>{list.length > visibleCount && <div ref={loadMoreRef} className="load-more"><button className="button-outline" onClick={() => setVisibleCount((current) => current + 8)}>ЗАГРУЗИТЬ ЕЩЁ <ArrowUpRight size={14} /></button><span>{shownVideos.length} / {list.length}</span></div>}</>
  }

  function renderHome() {
    const title = page === 'Home' ? 'ГЛАВНАЯ / ЛЕНТА' : pageNames[page].toUpperCase()
    return <section className="page-transition">
      {page === 'Home' ? <div className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> ЛОКАЛЬНАЯ ВИДЕОСЕТЬ / 001</div><h1>СИГНАЛ<br /><em>ТВОЙ.</em></h1><p>Личная видеотека из альтернативного будущего.<br />Файлы хранятся на этом устройстве.</p><button className="hero-cta" onClick={() => user ? navigate('Upload') : setAuthMode('login')}><Upload size={16} /> ЗАГРУЗИТЬ ВИДЕО</button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="hero-play"><Play size={25} fill="currentColor" /></div><span className="hero-coordinate">42° 06' / ЛОКАЛЬНЫЙ УЗЕЛ</span><span className="hero-stamp">MT<br />01</span></div><div className="hero-bottom"><span>MINITUBE // ЛИЧНЫЙ ЭФИР</span><span>● ХРАНИЛИЩЕ АКТИВНО</span></div></div> : <div className="page-banner"><span className="eyebrow">MINITUBE / КАТАЛОГ АРХИВА</span><h1>{title}<span>.</span></h1><p>{page === 'Trending' ? 'Самые просматриваемые сигналы вашей библиотеки.' : page === 'Subscriptions' ? 'Новые видео от каналов, на которые вы подписаны.' : page === 'History' ? 'Недавно просмотренные записи.' : page === 'Saved' ? 'Видео, отмеченные для просмотра.' : 'Все видео, добавленные в вашу библиотеку.'}</p></div>}
      {page === 'Home' && <div className="section-heading latest-heading"><div><span className="eyebrow">01 / НОВЫЕ ВИДЕО</span><h2>НОВЫЕ ВИДЕО</h2></div><button className="text-link" onClick={() => navigate('My Videos')}>ВСЯ БИБЛИОТЕКА <ArrowUpRight size={14} /></button></div>}
      <div className="filter-row"><div className="category-list">{categories.map((item) => <button key={item} className={`category-pill ${category === item ? 'selected' : ''}`} onClick={() => { setCategory(item); setVisibleCount(8) }}>{categoryNames[item] ?? item}</button>)}</div><div className="search-field"><Search size={15} /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(8) }} placeholder="ПОИСК ПО АРХИВУ" aria-label="Поиск по архиву" />{query && <button onClick={() => { setQuery(''); setVisibleCount(8) }} aria-label="Очистить поиск"><X size={14} /></button>}</div></div>
      {renderGrid(filteredVideos)}
    </section>
  }

  function renderVideoPage() {
    if (!selectedVideo) return <div className="empty-state"><button className="button-outline" onClick={() => navigate('Home')}><ArrowLeft size={15} /> В БИБЛИОТЕКУ</button></div>
    const reaction = reactions[selectedVideo.id]
    const likes = (readStore<Record<string, number>>('likeCounts', {})[selectedVideo.id] ?? 0) + (reaction === 'like' ? 1 : 0)
    const thread = comments[selectedVideo.id] ?? []
    return <section className="page-transition video-page"><button className="back-link" onClick={() => navigate('Home')}><ArrowLeft size={15} /> НАЗАД К ЛЕНТЕ</button><div className="player-shell"><video ref={playerRef} key={selectedVideo.id} className="main-player" src={fileUrl(selectedVideo.id)} controls autoPlay playsInline onTimeUpdate={(event) => setPlayerTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setPlayerDuration(event.currentTarget.duration)} /><div className="player-live-tag"><span className="live-dot" /> ВОСПРОИЗВЕДЕНИЕ</div></div><div className="player-under"><div className="player-title-area"><div className="eyebrow">{(selectedVideo.category || 'ВИДЕО').toUpperCase()} / {formatDate(selectedVideo.createdAt)}</div><h1>{selectedVideo.title}</h1><p>{selectedVideo.description || 'Локальная видеозапись. Оригинальный файл хранится на этом устройстве.'}</p><div className="player-byline"><span className="avatar-small avatar-large">{initials(currentAuthor(selectedVideo))}</span><span><b>{currentAuthor(selectedVideo)}</b><small>{(views[selectedVideo.id] ?? 0).toLocaleString()} {pluralize(views[selectedVideo.id] ?? 0, 'просмотр', 'просмотра', 'просмотров')} · {formatSize(selectedVideo.size)}</small></span><button className={`subscribe-button ${subscriptions.includes(currentAuthor(selectedVideo)) ? 'subscribed' : ''}`} onClick={() => toggleSubscription(currentAuthor(selectedVideo))}>{subscriptions.includes(currentAuthor(selectedVideo)) ? <><Check size={14} /> ВЫ ПОДПИСАНЫ</> : <><Plus size={14} /> ПОДПИСАТЬСЯ</>}</button></div></div><div className="player-controls-extra"><span><Clock3 size={14} /> {formatTime(playerTime)} / {formatTime(playerDuration)}</span><label><Gauge size={14} /><select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} aria-label="Скорость воспроизведения">{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label></div></div><div className="video-actions"><button className={reaction === 'like' ? 'chosen' : ''} onClick={() => toggleReaction(selectedVideo.id, 'like')}><ThumbsUp size={16} /> НРАВИТСЯ <b>{likes}</b></button><button className={reaction === 'dislike' ? 'chosen' : ''} onClick={() => toggleReaction(selectedVideo.id, 'dislike')}><ThumbsDown size={16} /> НЕ НРАВИТСЯ</button><button onClick={() => void shareVideo()}><Share2 size={16} /> ПОДЕЛИТЬСЯ</button><button className={saved.includes(selectedVideo.id) ? 'chosen' : ''} onClick={() => toggleSaved(selectedVideo.id)}><Bookmark size={16} /> {saved.includes(selectedVideo.id) ? 'СОХРАНЕНО' : 'СОХРАНИТЬ'}</button><button onClick={reportVideo}><MessageSquareWarning size={16} /> ПОЖАЛОВАТЬСЯ</button></div><section className="comments-section"><div className="section-heading"><div><span className="eyebrow">ОБСУЖДЕНИЕ</span><h2>КОММЕНТАРИИ <span>{thread.length.toString().padStart(2, '0')}</span></h2></div></div><form className="comment-form" onSubmit={(event) => void addComment(event)}><div className="avatar-small">{initials(profile.name)}</div><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={user ? 'Оставьте сообщение в эфире…' : 'Войдите, чтобы комментировать'} /><button className="send-button" type="submit" aria-label="Отправить комментарий"><Send size={16} /></button></form>{thread.length ? thread.map((comment) => <article className="comment-item" key={comment.id}><div className="avatar-small">{initials(comment.name)}</div><div className="comment-content"><div><b>{comment.name}</b><small>{formatDate(comment.createdAt)}</small></div><p>{comment.text}</p><button onClick={() => likeComment(comment.id)}><ThumbsUp size={13} /> {comment.likes}</button><button onClick={() => setCommentText(`@${comment.name} `)}>↳ ОТВЕТИТЬ</button></div></article>) : <div className="comment-empty">ПОКА ТИХО. СТАНЬТЕ ПЕРВЫМ, КТО ОСТАВИТ СООБЩЕНИЕ.</div>}</section></section>
  }

  function renderUpload() {
    return <section className="page-transition upload-page"><div className="page-banner"><span className="eyebrow">ЗАГРУЗКА / НОВЫЙ ФАЙЛ</span><h1>ЗАГРУЗИТЬ ВИДЕО<span>.</span></h1><p>Перетащите файл — прогресс загрузки отобразится в реальном времени.</p></div><form className="upload-form" onSubmit={uploadVideo}><div className={`dropzone ${dragging ? 'dropzone-active' : ''} ${selectedFile ? 'has-file' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); setFile(event.dataTransfer.files[0]) }} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') fileInputRef.current?.click() }}><input ref={fileInputRef} hidden type="file" accept="video/*" onChange={onFileInput} /><div className="drop-icon"><Upload size={25} /></div><b>{selectedFile ? selectedFile.name : 'ПЕРЕТАЩИТЕ ВИДЕО'}</b><span>{selectedFile ? `${formatSize(selectedFile.size)} · ${selectedFile.type || 'ВИДЕО'}` : 'ИЛИ ВЫБЕРИТЕ ФАЙЛ / MP4 · WEBM · MOV'}</span>{selectedFile && <button type="button" className="remove-file" onClick={(event) => { event.stopPropagation(); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setSelectedFile(null); setUploadTitle('') }}><X size={14} /> УБРАТЬ ФАЙЛ</button>}</div>
      {previewUrl && <div className="upload-preview"><video src={previewUrl} controls /><div className="progress-info"><span>{uploading ? 'ЗАГРУЗКА НА ДИСК' : 'ПРЕДПРОСМОТР'} <b>{progress}%</b></span><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div></div>}
      <div className="form-grid"><label className="form-field"><span>НАЗВАНИЕ ВИДЕО</span><input name="title" required maxLength={120} value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} /></label><label className="form-field"><span>КАТЕГОРИЯ</span><select name="category" defaultValue="Other">{categories.filter((item) => item !== 'All').map((item) => <option value={item} key={item}>{categoryNames[item] ?? item}</option>)}</select></label><label className="form-field form-field-wide"><span>ОПИСАНИЕ</span><textarea name="description" maxLength={2000} placeholder="Добавьте описание…" /></label></div>
      {error && <div className="inline-error"><X size={14} /> {error}</div>}<button className="publish-button" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={16} /> ЗАГРУЖАЕТСЯ {progress}%</> : <><Radio size={16} /> ОПУБЛИКОВАТЬ ВИДЕО</>}</button><p className="upload-privacy"><HardDrive size={13} /> Видео сохраняется в папку storage/videos на этом компьютере.</p></form></section>
  }

  async function readImage(file?: File) { if (!file) return ''; const isImage = file.type.startsWith('image/') || /\.(gif|png|jpe?g|webp|bmp)$/i.test(file.name); if (!isImage) throw new Error('Выберите изображение или GIF'); if (file.size > 3 * 1024 * 1024) throw new Error('Изображение должно быть меньше 3 МБ'); return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать изображение')); reader.readAsDataURL(file) }) }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
    try {
      const avatarInput = data.get('avatar');
      const coverInput = data.get('cover');
      const avatar = avatarInput instanceof File ? await readImage(avatarInput) : '';
      const cover = coverInput instanceof File ? await readImage(coverInput) : '';
      const username = String(data.get('username') || '').trim().slice(0, 32); const name = String(data.get('name') || '').trim().slice(0, 32); const backgroundColor = String(data.get('backgroundColor') || profile.backgroundColor || '#121212');
      if (!username) { setError('Введите username'); return }
      if (!name) { setError('Введите имя пользователя'); return }
      const next = { ...profile, username, name, about: String(data.get('about') || '').trim().slice(0, 280), avatar: avatar || profile.avatar, cover: cover || profile.cover, backgroundColor: /^#[0-9a-fA-F]{6}$/.test(backgroundColor) ? backgroundColor : profile.backgroundColor || '#121212' }
      setProfile(next); setUser((current) => current ? { ...current, username: next.username, name: next.name } : current); if (user) { writeStore('session', { ...user, username: next.username, name: next.name }); writeStore('accounts', accountList.map((account) => account.email === user.email ? { ...account, username: next.username, name: next.name } : account)) }
      setNotice('Профиль сохранён'); notify('Изменения профиля сохранены')
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить профиль') }
  }

  function renderChannel() {
    const channelVideos = currentUserVideos.filter((video) => currentAuthor(video) === selectedChannel)
    const channelViews = channelVideos.reduce((sum, video) => sum + (views[video.id] ?? 0), 0)
    const channelLikes = channelVideos.filter((video) => reactions[video.id] === 'like').length
    const isOwnChannel = Boolean(user && (selectedChannel === profile.name || selectedChannel === user.name))
    const isSubscribed = subscriptions.includes(selectedChannel)
    const channelDescription = isOwnChannel ? profile.about : channelVideos.find((video) => video.description)?.description || 'Канал автора в локальной видеосети.'
    return <section className="page-transition profile-page channel-page">
      <div className="profile-cover channel-cover" style={isOwnChannel ? { backgroundColor: profile.backgroundColor || '#121212', backgroundImage: profile.cover ? `linear-gradient(90deg,#1119,#1112),url(${profile.cover})` : undefined } : { backgroundColor: profile.backgroundColor || '#121212' }}>
        <span>MINITUBE / КАНАЛ</span><b>ЛОКАЛЬНЫЙ СИГНАЛ — {selectedChannel}</b>
      </div>
      <div className="profile-identity">
        <button className="profile-avatar channel-avatar" onClick={() => { if (isOwnChannel) navigate('Profile') }} aria-label={isOwnChannel ? 'Открыть свой профиль' : `Канал ${selectedChannel}`}>
          {isOwnChannel && profile.avatar ? <img src={profile.avatar} alt="" /> : initials(selectedChannel)}
        </button>
        <div className="profile-name"><h1>{selectedChannel}</h1><p>{isOwnChannel ? user?.email : 'КАНАЛ АВТОРА'}</p></div>
        <button className={`subscribe-button channel-subscribe ${isSubscribed ? 'subscribed' : ''}`} onClick={() => toggleSubscription(selectedChannel)}>
          {isSubscribed ? <><Check size={14} /> ВЫ ПОДПИСАНЫ</> : <><Plus size={14} /> ПОДПИСАТЬСЯ</>}
        </button>
        <div className="profile-stats">
          <div><b>{channelVideos.length}</b><span>ВИДЕО</span></div>
          <div><b>{channelLikes}</b><span>НРАВИТСЯ</span></div>
          <div><b>{channelViews}</b><span>ПРОСМОТРОВ</span></div>
        </div>
      </div>
      <div className="profile-description">{channelDescription}</div>
      <div className="section-heading profile-video-heading"><div><span className="eyebrow">КАНАЛ / ПУБЛИКАЦИИ</span><h2>ВИДЕО АВТОРА</h2></div></div>
      {renderGrid(channelVideos)}
    </section>
  }
  function renderProfile() {
    return <section className="page-transition profile-page"><div className="profile-cover" style={{ backgroundColor: profile.backgroundColor || '#121212', backgroundImage: profile.cover ? `linear-gradient(90deg,#1119,#1112),url(${profile.cover})` : undefined }}><span>MINITUBE / КАНАЛ {user ? '01' : 'ГОСТЬ'}</span><b>ЛОКАЛЬНЫЙ СИГНАЛ — {profile.name}</b></div><div className="profile-identity"><div className="profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="Аватар" /> : initials(profile.name)}</div><div className="profile-name"><h1>{profile.name}</h1><p>{user?.email ?? 'ГОСТЕВОЙ ПРОФИЛЬ'}</p></div><div className="profile-stats"><div><b>0</b><span>ПОДПИСЧИКОВ</span></div><div><b>{subscriptions.length}</b><span>ПОДПИСКИ</span></div><div><b>{videos.filter((video) => !video.owner || video.owner === user?.email).length}</b><span>ВИДЕО</span></div><div><b>{signedTotal}</b><span>ОТМЕТКИ «НРАВИТСЯ»</span></div><div><b>{Object.values(views).reduce((sum, value) => sum + value, 0)}</b><span>ПРОСМОТРЫ</span></div></div></div><div className="profile-description">{profile.about || 'Добавьте описание канала.'}</div><div className="section-heading"><div><span className="eyebrow">АККАУНТ / НАСТРОЙКИ</span><h2>ИЗМЕНИТЬ ПРОФИЛЬ</h2></div><button className="text-link" onClick={() => navigate('Upload')}><Plus size={14} /> ЗАГРУЗИТЬ</button></div><form className="profile-form" onSubmit={(event) => void saveProfile(event)}><label className="form-field"><span>ИМЯ ПОЛЬЗОВАТЕЛЯ</span><input name="name" required maxLength={32} defaultValue={profile.name} /></label><label className="form-field"><span>ЦВЕТ ФОНА</span><input name="backgroundColor" type="color" defaultValue={profile.backgroundColor || '#121212'} /></label><label className="form-field"><span>АВАТАР / ИЗОБРАЖЕНИЕ ИЛИ GIF</span><input name="avatar" type="file" accept="image/*,.gif,.png,.jpg,.jpeg,.webp" /></label><label className="form-field"><span>ФОН / ИЗОБРАЖЕНИЕ ИЛИ GIF</span><input name="cover" type="file" accept="image/*,.gif,.png,.jpg,.jpeg,.webp" /></label><label className="form-field form-field-wide"><span>О СЕБЕ</span><textarea name="about" maxLength={280} defaultValue={profile.about} /></label><button className="publish-button" type="submit"><Check size={15} /> СОХРАНИТЬ ПРОФИЛЬ</button></form><div className="section-heading profile-video-heading"><div><span className="eyebrow">ВАШИ ВИДЕО</span><h2>МОИ ВИДЕО</h2></div><button className="text-link" onClick={() => navigate('Upload')}>＋ ЗАГРУЗИТЬ</button></div>{renderGrid(videos.filter((video) => !video.owner || video.owner === user?.email))}</section>
  }

  function renderAdmin() {
    const dayTotals = Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setDate(day.getDate() - (6 - index)); const key = day.toDateString(); return videos.filter((video) => new Date(video.createdAt).toDateString() === key).length })
    const max = Math.max(1, ...dayTotals)
    const filtered = videos.filter((video) => `${video.title} ${currentAuthor(video)} ${video.category ?? ''}`.toLowerCase().includes(adminSearch.toLowerCase()))
    const allUsers = accountList.map((account) => account.email)
    return <section className="page-transition admin-page"><div className="admin-header"><div><span className="eyebrow"><span className="live-dot" /> ЛОКАЛЬНЫЙ СЕРВЕР / ВИДЕОТЕКА</span><h1>АДМИН-ПАНЕЛЬ<span>.</span></h1><p>Состояние локальной видеосистемы. Аналитика хранится в этом браузере.</p></div><div className="terminal-status">СИСТЕМА<br /><b>В СЕТИ</b><span>127.0.0.1 / ЛОКАЛЬНО</span></div></div><div className="stat-grid"><div><span>ПОЛЬЗОВАТЕЛИ</span><b>{allUsers.length}</b><small>ЛОКАЛЬНЫЕ АККАУНТЫ</small></div><div><span>ВИДЕО</span><b>{videos.length}</b><small>{formatSize(totalSize)} НА ДИСКЕ</small></div><div><span>ПРОСМОТРЫ</span><b>{Object.values(views).reduce((sum, count) => sum + count, 0)}</b><small>В ЭТОМ БРАУЗЕРЕ</small></div><div><span>ЖАЛОБЫ</span><b>{reports.length.toString().padStart(2, '0')}</b><small>ПОЛУЧЕНО</small></div></div><div className="admin-chart-panel"><div className="section-heading"><div><span className="eyebrow">ЗАГРУЗКИ / ЛОКАЛЬНАЯ СТАТИСТИКА</span><h2>МОНИТОР СОБЫТИЙ</h2></div><span className="section-counter">ПОСЛЕДНИЕ 7 ДНЕЙ</span></div><div className="chart-bars">{dayTotals.map((amount, index) => <div className="chart-column" key={index}><span>{amount}</span><i style={{ height: `${Math.max(6, amount / max * 100)}%` }} /><small>{new Intl.DateTimeFormat('ru', { weekday: 'short' }).format(new Date(Date.now() - (6 - index) * 86400000)).toUpperCase()}</small></div>)}</div></div><div className="admin-tabs">{(['Activity', 'Users', 'Videos', 'Reports'] as const).map((tab) => <button key={tab} className={adminTab === tab ? 'active' : ''} onClick={() => setAdminTab(tab)}>{adminTabNames[tab]}</button>)}<label className="search-field admin-search"><Search size={14} /><input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="ПОИСК ПО СПИСКУ" /></label></div>{adminTab === 'Users' ? <div className="admin-table-wrap"><table><thead><tr><th>ПОЧТА / ID</th><th>СТАТУС</th><th>ВИДЕО</th><th>СЕАНС</th></tr></thead><tbody>{allUsers.filter((email) => email.toLowerCase().includes(adminSearch.toLowerCase())).map((email) => <tr key={email}><td>{email}</td><td><span className="table-live">● АКТИВЕН</span></td><td>{videos.filter((video) => video.owner === email).length}</td><td>{user?.email === email ? 'ЭТО УСТРОЙСТВО' : 'ЛОКАЛЬНЫЙ'}</td></tr>)}</tbody></table>{!allUsers.length && <p className="table-empty">Локальные учётные записи появятся после регистрации.</p>}</div> : adminTab === 'Reports' ? <div className="admin-table-wrap"><table><thead><tr><th>ID ВИДЕО</th><th>ЖАЛОБА</th><th>СТАТУС</th></tr></thead><tbody>{reports.filter((id) => videos.some((video) => video.id === id)).map((id) => <tr key={id}><td>{videos.find((video) => video.id === id)?.title}</td><td>ЖАЛОБА ПОЛЬЗОВАТЕЛЯ</td><td><span className="table-live">● ЗАПИСАНА</span></td></tr>)}</tbody></table>{reports.length === 0 && <p className="table-empty">Жалоб пока нет.</p>}</div> : adminTab === 'Videos' ? <div className="admin-table-wrap"><table><thead><tr><th>ВИДЕО</th><th>АВТОР</th><th>ПРОСМОТРЫ</th><th>КАТЕГОРИЯ</th><th>РАЗМЕР</th></tr></thead><tbody>{filtered.map((video) => <tr key={video.id}><td>{video.title}</td><td>{currentAuthor(video)}</td><td>{views[video.id] ?? 0}</td><td>{categoryNames[video.category || 'Other'] ?? 'Другое'}</td><td>{formatSize(video.size)}</td></tr>)}</tbody></table></div> : <div className="activity-feed">{videos.slice(0, 10).map((video) => <div key={video.id}><span className="activity-mark"><Clapperboard size={14} /></span><span><b>ВИДЕО ДОБАВЛЕНО</b><small>{video.title} · {currentAuthor(video)}</small></span><time>{formatDate(video.createdAt)}</time></div>)}{!videos.length && <p className="table-empty">Ожидание первой записи в архиве…</p>}</div>}<p className="admin-note"><Activity size={13} /> Метрики являются локальными и не отправляются на внешний сервер.</p></section>
  }

  async function hashPassword(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') }
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError('')
    const form = new FormData(event.currentTarget); const email = String(form.get('email')).trim().toLowerCase(); const password = String(form.get('password')); const accounts = readStore<Account[]>('accounts', [])
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450)); const passwordHash = await hashPassword(password); let account = accounts.find((item) => item.email === email)
      if (authMode === 'register') { if (account) throw new Error('Этот email уже зарегистрирован.'); account = { email, username: profile.username, name: profile.name, passwordHash }; writeStore('accounts', [...accounts, account]) }
      else if (!account || account.passwordHash !== passwordHash) throw new Error('Неверный email или пароль.')
      const nextUser = { email, username: account.username || profile.username, name: account.name }; setUser(nextUser); writeStore('session', nextUser); setProfile((current) => current.name === 'ЛОКАЛЬНЫЙ_СИГНАЛ' ? { ...current, username: nextUser.username, name: account!.name } : current); setAuthMode(null); notify(authMode === 'register' ? 'Аккаунт создан' : 'Вы вошли в MiniTube')
    } catch (authError) { setAuthError(authError instanceof Error ? authError.message : 'Ошибка авторизации') }
    finally { setAuthBusy(false) }
  }

  const pageIcon = (name: Page) => {
    const iconProps = { size: 17, strokeWidth: 1.8 }
    switch (name) { case 'Home': return <Clapperboard {...iconProps} />; case 'Trending': return <Flame {...iconProps} />; case 'Subscriptions': return <Radio {...iconProps} />; case 'History': return <History {...iconProps} />; case 'Saved': return <Bookmark {...iconProps} />; case 'My Videos': return <FileVideo {...iconProps} />; case 'Profile': return <UserRound {...iconProps} />; case 'Upload': return <Upload {...iconProps} />; case 'Admin': return <LayoutDashboard {...iconProps} />; default: return <Play {...iconProps} /> }
  }
  const navItems: Page[] = ['Home', 'Trending', 'Subscriptions', 'History', 'Saved', 'My Videos']
  const view = page === 'Video' ? renderVideoPage() : page === 'Channel' ? renderChannel() : page === 'Upload' ? renderUpload() : page === 'Profile' ? renderProfile() : page === 'Admin' ? renderAdmin() : renderHome()

  return <main className="app-shell" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { if (event.dataTransfer.files.length) onDrop(event) }}>
    {dragging && <div className="global-drop"><Upload size={28} /><b>ОТПУСТИТЕ ФАЙЛ ДЛЯ ЗАГРУЗКИ</b></div>}
    <aside className="sidebar"><button className="brand" onClick={() => navigate('Home')}><span className="brand-mark"><Play size={17} fill="currentColor" /></span><span>MINI<span>TUBE</span><small>ЛОКАЛЬНЫЙ ВИДЕОТЕРМИНАЛ</small></span></button><div className="nav-group"><span className="nav-heading">БИБЛИОТЕКА / 01</span>{navItems.map((item) => <button key={item} className={`nav-link ${page === item ? 'active' : ''}`} title={pageNames[item]} aria-label={pageNames[item]} onClick={() => navigate(item)}>{pageIcon(item)}<span>{pageNames[item]}</span>{item === 'My Videos' && <small>{videos.length}</small>}</button>)}</div><div className="nav-group system-group"><span className="nav-heading">СИСТЕМА / 02</span><button className={`nav-link ${page === 'Profile' ? 'active' : ''}`} onClick={() => navigate('Profile')}>{pageIcon('Profile')}<span>Каналы</span></button><button className={`nav-link ${page === 'Admin' ? 'active' : ''}`} onClick={() => navigate('Admin')}>{pageIcon('Admin')}<span>Админ-панель</span></button></div><div className="sidebar-profile"><button className="profile-trigger" onClick={() => setMenuOpen((open) => !open)}><span className="avatar-small">{profile.avatar ? <img src={profile.avatar} alt="" /> : initials(profile.name)}</span><span><b>{user ? profile.name : 'ГОСТЬ'}</b><small>{user ? 'ЛОКАЛЬНЫЙ АККАУНТ' : 'ВОЙДИТЕ В АККАУНТ'}</small></span><ChevronDown size={14} /></button>{menuOpen && <div className="profile-menu">{user ? <><button onClick={() => navigate('Profile')}><UserRound size={14} /> МОЙ КАНАЛ</button><button onClick={() => navigate('Upload')}><Upload size={14} /> ЗАГРУЗИТЬ</button><button onClick={logout}><LogOut size={14} /> ВЫЙТИ</button></> : <><button onClick={() => { setAuthMode('login'); setMenuOpen(false) }}><LogIn size={14} /> ВОЙТИ</button><button onClick={() => { setAuthMode('register'); setMenuOpen(false) }}><UserPlus size={14} /> РЕГИСТРАЦИЯ</button></>}</div>}</div></aside>
    <section className="main-panel"><header className="topbar"><label className="global-search"><Search size={16} /><input ref={globalSearchRef} value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(8); if (page !== 'Video') setPage('Home') }} placeholder="ПОИСК ПО ВИДЕО..." aria-label="Поиск видео" />{query && <button onClick={() => { setQuery(''); setVisibleCount(8) }} aria-label="Очистить поиск"><X size={14} /></button>}<kbd>⌘ K</kbd></label><div className="topbar-actions"><button className="top-avatar" onClick={() => user ? navigate('Profile') : setAuthMode('login')}>{profile.avatar ? <img src={profile.avatar} alt="" /> : initials(profile.name)}</button></div></header><div className="content-wrap">{error && <div className="system-alert"><X size={15} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}{notice && <div className="system-alert success-alert"><Check size={15} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}{view}<footer className="page-footer"><span>MINITUBE / ЛОКАЛЬНАЯ ВИДЕОСЕТЬ</span><span>ФАЙЛЫ ОСТАЮТСЯ НА ЭТОМ УСТРОЙСТВЕ <i className="live-dot" /></span></footer></div></section>
    {authMode && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAuthMode(null); setAuthError('') } }}><form className="auth-modal" onSubmit={(event) => void submitAuth(event)}><button type="button" className="modal-close" onClick={() => { setAuthMode(null); setAuthError('') }} aria-label="Закрыть"><X size={18} /></button><span className="eyebrow">MINITUBE / ВХОД В АККАУНТ</span><h2>{authMode === 'register' ? 'СОЗДАТЬ АККАУНТ' : 'С ВОЗВРАЩЕНИЕМ'}<span>.</span></h2><p>Профиль хранится только в локальной среде браузера.</p><label className="form-field"><span>ЭЛЕКТРОННАЯ ПОЧТА</span><input name="email" type="email" autoComplete="email" required placeholder="имя@сеть.локально" /></label><label className="form-field"><span>ПАРОЛЬ</span><input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={6} required placeholder="минимум 6 символов" /></label>{authError && <div className="inline-error"><X size={14} /> {authError}</div>}<button className="publish-button" disabled={authBusy}>{authBusy ? <><LoaderCircle className="spin" size={15} /> ПОДКЛЮЧЕНИЕ…</> : authMode === 'register' ? <><UserPlus size={15} /> ЗАРЕГИСТРИРОВАТЬСЯ</> : <><LogIn size={15} /> ВОЙТИ</>}</button><button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError('') }}>{authMode === 'register' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}</button></form></div>}
    {toast && <div className="toast-message"><Sparkles size={15} /> {toast}</div>}
  </main>
}

export default App
