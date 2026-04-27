import cloudbase from '@cloudbase/js-sdk'

// ==================== 配置 ====================
const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID
const collectionName = 'user_accounts'
const communityCollectionName = 'community_posts'
const communityReplyCollectionName = 'community_replies'
const communityVoteCollectionName = 'community_votes'
const courseFavoriteCollectionName = 'course_favorites'

let app: ReturnType<typeof cloudbase.init> | null = null
let initPromise: Promise<void> | null = null

// 仅在 envId 存在时初始化
if (envId) {
  app = cloudbase.init({ env: envId })
  const auth = app.auth({ persistence: 'local' })
  // 匿名登录是数据库操作的前提
  initPromise = auth.signInAnonymously()
    .then(() => {
      console.log('[CloudBase] 匿名登录成功，环境ID:', envId)
    })
    .catch((err: unknown) => {
    console.error('[CloudBase] 匿名登录失败', err)
    throw err
  })
}

/**
 * 等待 CloudBase 完全就绪（包括匿名登录）
 * 所有数据库操作必须先调用此函数
 */
export async function waitForCloudBase() {
  if (!envId) throw new Error('缺少 VITE_CLOUDBASE_ENV_ID 环境变量')
  if (!app) throw new Error('CloudBase 未初始化')
  if (initPromise) await initPromise
  const db = app.database()
  const collection = db.collection(collectionName)
  return { db, collection }
}

export const cloudbaseReady = Boolean(envId && app)
export const cloudbaseCollectionName = collectionName
export const cloudbaseCommunityCollectionName = communityCollectionName
export const cloudbaseCommunityReplyCollectionName = communityReplyCollectionName
export const cloudbaseCommunityVoteCollectionName = communityVoteCollectionName
export const cloudbaseCourseFavoriteCollectionName = courseFavoriteCollectionName

// ==================== 类型定义 ====================
export type CloudbaseProfile = {
  id?: string
  phone: string
  avatarUrl?: string
  nickname?: string
  password?: string
  updatedAt?: string
  dailyStudyMinutes?: number
  learnedCourseIds?: number[]
  points?: number
  postCount?: number
}

export type CloudbaseWriteResult = { ok: boolean; error: string }
export type CloudbaseCommunityPost = {
  id?: string
  title: string
  content: string
  tag: string
  authorId: string
  authorName: string
  authorRole: '家长' | '志愿者'
  createdAt: string
  updatedAt?: string
  acceptedReplyId?: string
  answerCount?: number
  viewCount?: number
  likeCount?: number
}
export type CloudbaseCommunityReply = {
  id?: string
  postId: string
  content: string
  authorId: string
  authorName: string
  authorRole: '家长' | '志愿者'
  createdAt: string
  updatedAt?: string
  isAccepted?: boolean
  likeCount?: number
}
export type CloudbaseCommunityVote = {
  id?: string
  targetType: 'post' | 'reply'
  targetId: string
  userId: string
  value: 1 | -1
  createdAt: string
}
export type CloudbaseCourseFavorite = {
  id?: string
  userId: string
  courseId: number
  courseTitle: string
  courseCategory: string
  courseDuration: string
  courseDesc: string
  createdAt: string
}

// ==================== 辅助函数 ====================
function normalize(record: unknown, fallbackPhone: string): CloudbaseProfile {
  const data = record && typeof record === 'object' ? record as Record<string, unknown> : {}
  const phone = String(data.phone ?? data.id ?? data._id ?? fallbackPhone)
  return {
    id: phone,
    avatarUrl: String(data.avatarUrl ?? ''),
    nickname: String(data.nickname ?? ''),
    phone,
    password: String(data.password ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    dailyStudyMinutes: Number(data.dailyStudyMinutes ?? 0),
    learnedCourseIds: Array.isArray(data.learnedCourseIds) ? data.learnedCourseIds.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [],
    points: Number(data.points ?? 0),
    postCount: Number(data.postCount ?? 0),
  }
}

function isPermissionError(error: unknown): boolean {
  const msg = String(error ?? '').toLowerCase()
  return msg.includes('permission') || msg.includes('auth') || msg.includes('unauthorized') || msg.includes('denied')
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizePost(record: unknown): CloudbaseCommunityPost | null {
  const data = record && typeof record === 'object' ? record as Record<string, unknown> : null
  if (!data) return null
  const title = String(data.title ?? '').trim()
  const content = String(data.content ?? '').trim()
  const tag = String(data.tag ?? '全部').trim()
  const authorId = String(data.authorId ?? '').trim()
  if (!title || !content || !authorId) return null
  return {
    id: String(data.id ?? data._id ?? ''),
    title,
    content,
    tag,
    authorId,
    authorName: String(data.authorName ?? '匿名用户'),
    authorRole: (data.authorRole === '志愿者' ? '志愿者' : '家长'),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? ''),
    acceptedReplyId: String(data.acceptedReplyId ?? ''),
    answerCount: Number(data.answerCount ?? 0),
    viewCount: Number(data.viewCount ?? 0),
    likeCount: Number(data.likeCount ?? 0),
  }
}

function normalizeReply(record: unknown): CloudbaseCommunityReply | null {
  const data = record && typeof record === 'object' ? record as Record<string, unknown> : null
  if (!data) return null
  const postId = String(data.postId ?? '').trim()
  const content = String(data.content ?? '').trim()
  const authorId = String(data.authorId ?? '').trim()
  if (!postId || !content || !authorId) return null
  return {
    id: String(data.id ?? data._id ?? ''),
    postId,
    content,
    authorId,
    authorName: String(data.authorName ?? '匿名用户'),
    authorRole: (data.authorRole === '志愿者' ? '志愿者' : '家长'),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? ''),
    isAccepted: Boolean(data.isAccepted),
    likeCount: Number(data.likeCount ?? 0),
  }
}

async function getCollectionByName(name: string) {
  const { db } = await waitForCloudBase()
  return db.collection(name)
}

function normalizeFavorite(record: unknown): CloudbaseCourseFavorite | null {
  const data = record && typeof record === 'object' ? record as Record<string, unknown> : null
  if (!data) return null
  const userId = String(data.userId ?? '').trim()
  const courseId = Number(data.courseId)
  if (!userId || !Number.isFinite(courseId)) return null
  return {
    id: String(data.id ?? data._id ?? ''),
    userId,
    courseId,
    courseTitle: String(data.courseTitle ?? ''),
    courseCategory: String(data.courseCategory ?? ''),
    courseDuration: String(data.courseDuration ?? ''),
    courseDesc: String(data.courseDesc ?? ''),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
  }
}

async function resolveUserProfileDocId(phone: string): Promise<string | null> {
  try {
    const { collection } = await waitForCloudBase()
    const docResult = await collection.doc(phone).get()
    const docRecord = docResult?.data
    if (docRecord && typeof docRecord === 'object') {
      const record = docRecord as { _id?: unknown; id?: unknown }
      const docId = record._id ?? record.id
      if (typeof docId === 'string' && docId.trim()) return docId
      return phone
    }
  } catch {
    // ignore and fallback below
  }

  try {
    const { collection } = await waitForCloudBase()
    const whereResult = await collection.where({ phone }).limit(1).get()
    const whereRecord = whereResult?.data?.[0]
    if (whereRecord && typeof whereRecord === 'object') {
      const record = whereRecord as { _id?: unknown; id?: unknown }
      const docId = record._id ?? record.id
      if (typeof docId === 'string' && docId.trim()) return docId
      return phone
    }
  } catch {
    // ignore and fallback below
  }

  return null
}

// ==================== 核心 CRUD ====================
export async function getUserProfile(phone: string): Promise<CloudbaseProfile | null> {
  if (!phone) return null

  try {
    const { collection } = await waitForCloudBase()
    const docResult = await collection.doc(phone).get()
    const docRecord = docResult?.data
    console.log('[getUserProfile] 原始返回数据:', JSON.stringify(docRecord, null, 2))

    if (docRecord && typeof docRecord === 'object' && Object.keys(docRecord).length > 0) {
      const normalized = normalize(docRecord, phone)
      console.log('[getUserProfile] 规范化后:', normalized)
      return normalized
    }
  } catch (err) {
    console.warn('[getUserProfile] doc查询失败', err)
  }

  try {
    const { collection } = await waitForCloudBase()
    // 2) 回退到 where 条件查询
    const whereResult = await collection.where({ phone }).limit(1).get()
    const whereRecord = whereResult?.data?.[0]
    if (whereRecord) {
      return normalize(whereRecord, phone)
    }
  } catch (err) {
    if (!isPermissionError(err)) console.warn('[getUserProfile] where查询失败', err)
  }

  return null
}

export async function saveUserProfile(profile: CloudbaseProfile): Promise<CloudbaseWriteResult> {
  if (!profile?.phone) {
    return { ok: false, error: '手机号不能为空' }
  }

  const existing = await getUserProfile(profile.phone)
  const payload = {
    phone: profile.phone,
    avatarUrl: profile.avatarUrl ?? existing?.avatarUrl ?? '',
    nickname: profile.nickname ?? existing?.nickname ?? '',
    password: profile.password?.trim() ? profile.password : (existing?.password ?? ''),
    updatedAt: new Date().toISOString(),
    dailyStudyMinutes: profile.dailyStudyMinutes ?? existing?.dailyStudyMinutes ?? 0,
    learnedCourseIds: profile.learnedCourseIds ?? existing?.learnedCourseIds ?? [],
    points: profile.points ?? existing?.points ?? 0,
    postCount: profile.postCount ?? existing?.postCount ?? 0,
  }

  try {
    const { collection } = await waitForCloudBase()
    const docId = await resolveUserProfileDocId(profile.phone)
    if (docId) {
      await collection.doc(docId).update(payload)
    } else {
      await collection.doc(profile.phone).set({ _id: profile.phone, id: profile.phone, ...payload })
    }
    const latest = await getUserProfile(profile.phone)
    if (latest && latest.phone === profile.phone) {
      return { ok: true, error: '' }
    }
    return { ok: false, error: '保存后未能重新读取到文档' }
  } catch (err) {
    console.error('[saveUserProfile] 保存失败', err)
    return { ok: false, error: isPermissionError(err) ? 'cloudbase-permission-denied' : String(err) }
  }
}

export async function updateUserLearningStats(phone: string, stats: Partial<Pick<CloudbaseProfile, 'dailyStudyMinutes' | 'learnedCourseIds' | 'points' | 'postCount'>>): Promise<CloudbaseWriteResult> {
  if (!phone) return { ok: false, error: '手机号不能为空' }
  try {
    const existing = await getUserProfile(phone)
    const { collection } = await waitForCloudBase()
    const docId = await resolveUserProfileDocId(phone)
    const payload = {
      phone,
      avatarUrl: existing?.avatarUrl ?? '',
      nickname: existing?.nickname ?? '',
      updatedAt: new Date().toISOString(),
      dailyStudyMinutes: stats.dailyStudyMinutes ?? existing?.dailyStudyMinutes ?? 0,
      learnedCourseIds: stats.learnedCourseIds ?? existing?.learnedCourseIds ?? [],
      points: stats.points ?? existing?.points ?? 0,
      postCount: stats.postCount ?? existing?.postCount ?? 0,
    }
    if (docId) {
      await collection.doc(docId).update(payload)
    } else {
      await collection.doc(phone).set({ _id: phone, id: phone, phone, avatarUrl: payload.avatarUrl, nickname: payload.nickname, updatedAt: payload.updatedAt, dailyStudyMinutes: payload.dailyStudyMinutes, learnedCourseIds: payload.learnedCourseIds, points: payload.points, postCount: payload.postCount, password: existing?.password ?? '' })
    }
    return { ok: true, error: '' }
  } catch (err) {
    console.error('[updateUserLearningStats] 保存失败', err)
    return { ok: false, error: isPermissionError(err) ? 'cloudbase-permission-denied' : String(err) }
  }
}

export async function deleteUserProfile(phone: string): Promise<boolean> {
  if (!phone || phone.trim() === '') return false
  try {
    const { collection } = await waitForCloudBase()
    await collection.doc(phone).remove()
    return true
  } catch (err) {
    console.error('[deleteUserProfile] 删除失败', err)
    return false
  }
}

export async function listCommunityPosts(): Promise<CloudbaseCommunityPost[]> {
  try {
    const collection = await getCollectionByName(communityCollectionName)
    const result = await collection.orderBy('createdAt', 'desc').get()
    return (result?.data ?? []).map(normalizePost).filter(Boolean) as CloudbaseCommunityPost[]
  } catch (err) {
    console.warn('[listCommunityPosts] 查询失败', err)
    return []
  }
}

export async function listCommunityReplies(postId: string): Promise<CloudbaseCommunityReply[]> {
  if (!postId) return []
  try {
    const collection = await getCollectionByName(communityReplyCollectionName)
    const result = await collection.where({ postId }).orderBy('createdAt', 'asc').get()
    return (result?.data ?? []).map(normalizeReply).filter(Boolean) as CloudbaseCommunityReply[]
  } catch (err) {
    console.warn('[listCommunityReplies] 查询失败', err)
    return []
  }
}

export async function createCommunityPost(post: Omit<CloudbaseCommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'answerCount' | 'viewCount' | 'likeCount' | 'acceptedReplyId'>): Promise<CloudbaseWriteResult & { id?: string }> {
  try {
    const collection = await getCollectionByName(communityCollectionName)
    const payload: CloudbaseCommunityPost = {
      ...post,
      id: createId('post'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      acceptedReplyId: '',
      answerCount: 0,
      viewCount: 0,
      likeCount: 0,
    }
    const res = await collection.add({ _id: payload.id, ...payload })
    const id = String((res as { id?: string } | undefined)?.id ?? payload.id)
    return { ok: true, error: '', id }
  } catch (err) {
    console.error('[createCommunityPost] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function createCommunityReply(reply: Omit<CloudbaseCommunityReply, 'id' | 'createdAt' | 'updatedAt' | 'isAccepted' | 'likeCount'>): Promise<CloudbaseWriteResult & { id?: string }> {
  try {
    const collection = await getCollectionByName(communityReplyCollectionName)
    const payload: CloudbaseCommunityReply = {
      ...reply,
      id: createId('reply'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAccepted: false,
      likeCount: 0,
    }
    const res = await collection.add({ _id: payload.id, ...payload })
    const id = String((res as { id?: string } | undefined)?.id ?? payload.id)
    return { ok: true, error: '', id }
  } catch (err) {
    console.error('[createCommunityReply] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function acceptCommunityReply(postId: string, replyId: string): Promise<CloudbaseWriteResult> {
  try {
    const postCollection = await getCollectionByName(communityCollectionName)
    const replyCollection = await getCollectionByName(communityReplyCollectionName)
    await postCollection.doc(postId).update({ acceptedReplyId: replyId, updatedAt: new Date().toISOString() })
    await replyCollection.doc(replyId).update({ isAccepted: true, updatedAt: new Date().toISOString() })
    return { ok: true, error: '' }
  } catch (err) {
    console.error('[acceptCommunityReply] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function updateCommunityPost(postId: string, data: Partial<Pick<CloudbaseCommunityPost, 'answerCount' | 'viewCount' | 'likeCount' | 'acceptedReplyId'>>): Promise<CloudbaseWriteResult> {
  try {
    const collection = await getCollectionByName(communityCollectionName)
    await collection.doc(postId).update({ ...data, updatedAt: new Date().toISOString() })
    return { ok: true, error: '' }
  } catch (err) {
    console.error('[updateCommunityPost] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function listCourseFavorites(userId: string): Promise<CloudbaseCourseFavorite[]> {
  if (!userId) return []
  try {
    const collection = await getCollectionByName(courseFavoriteCollectionName)
    const result = await collection.where({ userId }).orderBy('createdAt', 'desc').get()
    return (result?.data ?? []).map(normalizeFavorite).filter(Boolean) as CloudbaseCourseFavorite[]
  } catch (err) {
    console.warn('[listCourseFavorites] 查询失败', err)
    return []
  }
}

export async function addCourseFavorite(favorite: Omit<CloudbaseCourseFavorite, 'id' | 'createdAt'>): Promise<CloudbaseWriteResult & { id?: string }> {
  try {
    const collection = await getCollectionByName(courseFavoriteCollectionName)
    const payload: CloudbaseCourseFavorite = {
      ...favorite,
      id: createId('fav'),
      createdAt: new Date().toISOString(),
    }
    const res = await collection.add({ _id: payload.id, ...payload })
    const id = String((res as { id?: string } | undefined)?.id ?? payload.id)
    return { ok: true, error: '', id }
  } catch (err) {
    console.error('[addCourseFavorite] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function removeCourseFavorite(userId: string, courseId: number): Promise<CloudbaseWriteResult> {
  try {
    const collection = await getCollectionByName(courseFavoriteCollectionName)
    const result = await collection.where({ userId, courseId }).limit(1).get()
    const record = result?.data?.[0] as { _id?: string; id?: string } | undefined
    const docId = record?._id || record?.id
    if (docId) {
      await collection.doc(docId).remove()
      return { ok: true, error: '' }
    }
    return { ok: false, error: '未找到收藏记录' }
  } catch (err) {
    console.error('[removeCourseFavorite] 失败', err)
    return { ok: false, error: String(err) }
  }
}

export async function verifyUser(phone: string, password: string): Promise<CloudbaseProfile | null> {
  if (!phone || !password) return null
  const cleanPassword = password.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s/g, '')
  try {
    const { collection } = await waitForCloudBase()
    const result = await collection.where({ phone, password: cleanPassword }).limit(1).get()
    const record = result?.data?.[0]
    return record ? normalize(record, phone) : null
  } catch (err) {
    console.warn('[verifyUser] 登录校验失败', err)
    return null
  }
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!file) throw new Error('请选择头像文件')
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('头像读取失败'))
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        reject(new Error('头像读取失败'))
        return
      }
      resolve(dataUrl)
    }
    reader.readAsDataURL(file)
  })
}