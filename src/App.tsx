import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import './App.css'
import { cloudbaseCollectionName, cloudbaseReady, verifyUser, getUserProfile, saveUserProfile, updateUserLearningStats, uploadAvatar, listCommunityPosts, listCommunityReplies, createCommunityPost, createCommunityReply, acceptCommunityReply, listCourseFavorites, addCourseFavorite, removeCourseFavorite } from './lib/cloudbase.ts'

type SectionKey = 'home' | 'profile' | 'courses' | 'community' | 'ai' | 'account'
type CourseCategory = 'all' | '理念唤醒篇' | '沟通赋能篇' | '方法赋能篇' | '心理赋能篇' | '网络安全篇' | '数字时代赋能篇' | '生活教育赋能篇' | '特殊群体赋能篇（针对祖辈）' | '社区共建赋能篇'

type Section = { key: SectionKey; label: string; title: string; desc: string }
type Course = { id: number; title: string; category: Exclude<CourseCategory, 'all'>; duration: string; progress: number; shortDesc: string; isLearned?: boolean }
type CoursePageState = { course: Course }
type ProfileDimensionKey = 'education' | 'communication' | 'digital' | 'time' | 'emotion'
type ProfileQuestion = { id: number; dimension: ProfileDimensionKey; prompt: string; options: string[] }
type ProfileResult = { total: number; dimensionScores: Record<ProfileDimensionKey, number>; dimensionTexts: Record<ProfileDimensionKey, string>; level: string; recommendationTitle: string; recommendationHint: string; change: number; changeText: string }
type AccountProfile = { avatarUrl: string; nickname: string; phone: string; password: string; loading: boolean; saving: boolean; message: string; editingPassword: boolean }
type AuthMode = 'login' | 'register'
type CommunityTag = '全部' | '学习方法' | '心理困惑' | '沟通问题' | '政策咨询' | '志愿者答疑'
type CommunityAuthorRole = '家长' | '志愿者'
type CommunityPost = {
  id: string
  title: string
  content: string
  tag: CommunityTag
  authorId: string
  authorName: string
  authorRole: CommunityAuthorRole
  createdAt: string
  acceptedReplyId?: string
  answerCount: number
  viewCount: number
  likeCount: number
}
type CommunityReply = {
  id: string
  postId: string
  content: string
  authorId: string
  authorName: string
  authorRole: CommunityAuthorRole
  createdAt: string
  isAccepted?: boolean
  likeCount: number
}
type CourseFavorite = {
  id: string
  userId: string
  courseId: number
  courseTitle: string
  courseCategory: string
  courseDuration: string
  courseDesc: string
  createdAt: string
}

const DEFAULT_AVATAR_URL = '/image/moren.png'

const sections: Section[] = [
  { key: 'home', label: '首页', title: '首页 · 今日推荐', desc: '集中展示今日推荐微课、学习提醒和县域家庭教育资讯。' },
  { key: 'profile', label: '画像', title: '我的画像 · 困境诊断', desc: '通过家长测评问卷生成教育参与画像，帮助发现短板方向。' },
  { key: 'courses', label: '微课', title: '微课学习 · 家长课堂', desc: '围绕县域家庭教育主题，按模块展示微课内容与学习入口。' },
  { key: 'ai', label: 'AI助手', title: 'AI 助手 · 24 小时答疑', desc: '预留智能问答页面布局，后续可接入对话模型服务。' },
  { key: 'community', label: '交流圈', title: '交流圈 · 家长互助', desc: '展示问题发布、经验交流、志愿者答疑等社区模块位置。' },
  { key: 'account', label: '个人中心', title: '个人中心 · 我的成长档案', desc: '展示个人信息、学习记录和发布内容入口，布局与交流圈统一。' },
]

const categories: Exclude<CourseCategory, 'all'>[] = ['理念唤醒篇', '沟通赋能篇', '方法赋能篇', '心理赋能篇', '网络安全篇', '数字时代赋能篇', '生活教育赋能篇', '特殊群体赋能篇（针对祖辈）', '社区共建赋能篇']

const courses: Course[] = [
  { id: 1, title: '我们都是教育合伙人', category: '理念唤醒篇', duration: '2分钟', progress: 72, shortDesc: '帮助家长建立“家校共育”的整体意识。', isLearned: true },
  { id: 2, title: '如何与老师“聊”出效果', category: '沟通赋能篇', duration: '3分钟', progress: 58, shortDesc: '掌握和老师高效沟通的表达方式。' },
  { id: 3, title: '沟通有方：微信家长群使用指南', category: '沟通赋能篇', duration: '2分钟', progress: 41, shortDesc: '学会在家长群里准确、礼貌、有效地交流。' },
  { id: 4, title: '不辅导作业，也能当好家长', category: '方法赋能篇', duration: '3分钟', progress: 66, shortDesc: '让家长从“盯作业”转向“会支持”。' },
  { id: 5, title: '读懂孩子的心', category: '心理赋能篇', duration: '2分钟', progress: 50, shortDesc: '从孩子的情绪变化中看见真实需求。' },
  { id: 6, title: '做情绪稳定的家长', category: '心理赋能篇', duration: '3分钟', progress: 36, shortDesc: '帮助家长在压力下保持稳定表达。' },
  { id: 7, title: '做孩子网络安全的哨兵', category: '网络安全篇', duration: '2分钟', progress: 29, shortDesc: '识别网络风险，陪孩子安全上网。' },
  { id: 8, title: '精准寻找，让优质课程主动“跳”出来', category: '数字时代赋能篇', duration: '2分钟', progress: 48, shortDesc: '学会精准搜索，快速找到需要的学习资源。' },
  { id: 9, title: '用好“AI家教”，给孩子独一无二的辅导', category: '数字时代赋能篇', duration: '3分钟', progress: 33, shortDesc: '认识 AI 工具在家庭学习中的支持作用。' },
  { id: 10, title: '生活即教育', category: '生活教育赋能篇', duration: '2分钟', progress: 64, shortDesc: '把生活场景变成孩子成长的课堂。', isLearned: true },
  { id: 11, title: '“隔代不隔心”——爷爷奶奶育儿课堂', category: '特殊群体赋能篇（针对祖辈）', duration: '3分钟', progress: 22, shortDesc: '帮助祖辈家长更好参与孩子教育。' },
  { id: 12, title: '“家长互助会”发起人培训', category: '社区共建赋能篇', duration: '3分钟', progress: 18, shortDesc: '带动家长社区自组织、互帮助。' },
]

const quickModules = [
  { key: 'profile', title: '我的画像', hint: '查看教育短板' },
  { key: 'courses', title: '微课学习', hint: '进入家长课堂' },
  { key: 'community', title: '交流圈', hint: '参与互助交流' },
  { key: 'ai', title: 'AI助手', hint: '获取即时答疑' },
] as const

const VIDEO_BACKGROUNDS = [
  '/image/lunbo1.png',
  '/image/lunbo2.png',
  '/image/lunbo3.png',
]

const videoMap: Record<number, string> = {
  1: '/video/1我们都是教育合伙人.mp4',
  2: '/video/2如何与老师聊出效果.mp4',
  3: '/video/3沟通有方微信家长群.mp4',
  4: '/video/4不辅导作业，也能当好家长.mp4',
  5: '/video/5读懂孩子的心.mp4',
  6: '/video/6做情绪稳定的家长.mp4',
  7: '/video/7做孩子网络安全的哨兵.mp4',
  8: '/video/8精准寻找，让优质课程主动“跳”出来.mp4',
  9: '/video/9用好“AI家教”，给孩子独一无二的辅导.mp4',
  10: '/video/10生活即教育.mp4',
  11: '/video/11“隔代不隔心”——爷爷奶奶育儿课堂.mp4',
  12: '/video/12新.mp4',
}

const profileQuestions: ProfileQuestion[] = [
  { id: 1, dimension: 'education', prompt: '您认为家长在孩子成长过程中的主要作用是？', options: ['提供吃穿住行即可', '监督孩子完成学校作业', '配合学校，共同培养孩子习惯和品格', '主导孩子的全部教育，包括学习、品德、兴趣'] },
  { id: 2, dimension: 'education', prompt: '您是否了解孩子所在年级的主要学习目标和课程内容？', options: ['完全不了解', '知道大概，但很少关注细节', '了解主要科目和学期重点', '非常清楚，并能结合孩子情况做辅导'] },
  { id: 3, dimension: 'education', prompt: '您对“家庭是人生的第一所学校”这句话的认同程度是？', options: ['不认同', '有点认同，但感觉作用不大', '比较认同，愿意多学习家庭教育知识', '非常认同，一直在主动学习实践'] },
  { id: 4, dimension: 'education', prompt: '您认为家长参与孩子的学习，最应该关注什么？', options: ['考试成绩', '作业完成情况', '学习态度和习惯', '孩子的兴趣、心理和全面发展'] },
  { id: 5, dimension: 'education', prompt: '您是否清楚当地学校或教育部门对家庭教育的支持政策（如家长课堂、家访等）？', options: ['完全不知道', '听说过，但不了解具体内容', '知道一些，偶尔参加相关活动', '很清楚，并且经常参与或咨询'] },
  { id: 6, dimension: 'communication', prompt: '您平时与孩子交流学校生活、学习情况的频率是？', options: ['基本不聊', '每周1-2次', '每周3-4次', '几乎每天都会聊'] },
  { id: 7, dimension: 'communication', prompt: '当孩子考试成绩不理想时，您通常会？', options: ['批评指责，甚至惩罚', '简单安慰几句', '和孩子一起分析错题原因', '先倾听孩子的感受，再共同制定改进计划'] },
  { id: 8, dimension: 'communication', prompt: '您与孩子班主任或任课老师主动联系的频率是？', options: ['从不联系', '每学期1次', '每月1次左右', '每两周或更频繁'] },
  { id: 9, dimension: 'communication', prompt: '在与老师沟通时，您是否能清晰表达孩子的特点和需求？', options: ['很难说清楚', '只能说大概', '能较清楚地描述', '很有条理，并能提供具体例子'] },
  { id: 10, dimension: 'communication', prompt: '您是否愿意主动向学校反馈家庭教育中的困难或建议？', options: ['不愿意，觉得说了也没用', '偶尔会提，但比较随意', '遇到问题时愿意反映', '会主动、定期和学校沟通，寻求合作'] },
  { id: 11, dimension: 'digital', prompt: '您是否会使用智能手机或电脑查看学校通知、班级群消息？', options: ['完全不会', '不太熟练，需要别人帮忙', '基本能独立操作', '很熟练，还能利用各种功能辅助孩子学习'] },
  { id: 12, dimension: 'digital', prompt: '您是否使用过教育类APP（如班级优化大师、中小学智慧教育平台等）？', options: ['没听说过', '听说过但没用过', '用过，但只看看通知', '经常使用，还能利用资源辅导孩子'] },
  { id: 13, dimension: 'digital', prompt: '当需要查找学习资料（如练习题、科普视频）时，您能否独立完成？', options: ['不能，完全不会搜索', '尝试过但很难找到想要的', '基本能找到需要的内容', '很擅长，还能筛选优质资源'] },
  { id: 14, dimension: 'digital', prompt: '您是否会使用工具(如微信、钉钉)与老师进行视频或语音沟通？', options: ['不会', '会发文字消息', '会发语音/图片', '熟练使用语音、视频等多种方式'] },
  { id: 15, dimension: 'digital', prompt: '您是否了解如何保护孩子上网安全（如设置青少年模式、防沉迷）？', options: ['完全不了解', '知道一点，但不会操作', '基本会设置', '非常了解，并能定期检查'] },
  { id: 16, dimension: 'time', prompt: '您平均每天用于陪伴孩子学习、活动的时间大约是？', options: ['30分钟以内', '30分钟-1小时', '1-2小时', '2小时以上'] },
  { id: 17, dimension: 'time', prompt: '您是否会专门抽出时间参加学校组织的家长会、开放日等活动？', options: ['从不参加', '偶尔参加（不到一半）', '大部分参加', '每次都参加，并提前安排工作'] },
  { id: 18, dimension: 'time', prompt: '您是否会在孩子写作业时主动在旁边陪伴或辅导？', options: ['从不', '偶尔', '经常（一周3-4次）', '每天都会'] },
  { id: 19, dimension: 'time', prompt: '您是否会利用周末或假期带孩子进行阅读、实践等活动？', options: ['从不', '很少（每月1次以内）', '有时（每月2-3次）', '经常（每周至少1次）'] },
  { id: 20, dimension: 'time', prompt: '您是否会花时间学习家庭教育知识（看书、听课、看短视频等）？', options: ['从不学习', '偶尔浏览一下', '每月有固定时间学习', '每周都会安排学习时间'] },
  { id: 21, dimension: 'emotion', prompt: '当孩子不听话或学习拖拉时，您通常的情绪反应是？', options: ['立即发火，大声斥责', '感到烦躁，但能忍住', '先深呼吸，再耐心询问原因', '能完全平静处理，并引导孩子自省'] },
  { id: 22, dimension: 'emotion', prompt: '您是否会因为工作、家庭琐事而将负面情绪发泄给孩子？', options: ['总是这样', '经常这样', '偶尔这样', '几乎不会'] },
  { id: 23, dimension: 'emotion', prompt: '在辅导孩子作业时，您通常会？', options: ['容易着急，甚至打骂', '会不耐烦，但尽量克制', '多数时候能耐心讲解', '始终保持平和，采用鼓励的方式'] },
  { id: 24, dimension: 'emotion', prompt: '当孩子犯错时，您是否能先控制自己的情绪，再解决问题？', options: ['很少能做到', '有时能做到', '大部分能做到', '总是能做到'] },
  { id: 25, dimension: 'emotion', prompt: '您是否会主动学习情绪管理的方法（如冥想、交流、运动等）？', options: ['从不', '偶尔', '比较积极', '经常，已成为习惯'] },
]

function App() {
  const [activeSection, setActiveSection] = useState<SectionKey>('home')
  const [authResolved, setAuthResolved] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authNickname, setAuthNickname] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authShowPassword, setAuthShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [profilePageOpen, setProfilePageOpen] = useState(false)
  const [profileResultPageOpen, setProfileResultPageOpen] = useState(false)
  const [profileAnswers, setProfileAnswers] = useState<Record<number, number>>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('teachingweb-profile') : null
    if (!saved) return Object.fromEntries(profileQuestions.map((question) => [question.id, 0])) as Record<number, number>
    try {
      const parsed = JSON.parse(saved) as { answers?: Record<number, number> }
      return { ...Object.fromEntries(profileQuestions.map((question) => [question.id, 0])) as Record<number, number>, ...(parsed.answers ?? {}) }
    } catch {
      return Object.fromEntries(profileQuestions.map((question) => [question.id, 0])) as Record<number, number>
    }
  })
  const [profileHistory, setProfileHistory] = useState<{ total: number; time: string }[]>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('teachingweb-profile') : null
    if (!saved) return [{ total: 59, time: '上次测评' }]
    try {
      const parsed = JSON.parse(saved) as { history?: { total: number; time: string }[] }
      return parsed.history?.length ? parsed.history : [{ total: 59, time: '上次测评' }]
    } catch {
      return [{ total: 59, time: '上次测评' }]
    }
  })
  const [profileLatestTotal, setProfileLatestTotal] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('teachingweb-profile') : null
    if (!saved) return 59
    try {
      const parsed = JSON.parse(saved) as { latestTotal?: number }
      return typeof parsed.latestTotal === 'number' ? parsed.latestTotal : 59
    } catch {
      return 59
    }
  })
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('teachingweb-profile') : null
    if (!saved) return null
    try {
      const parsed = JSON.parse(saved) as { result?: ProfileResult }
      return parsed.result ?? null
    } catch {
      return null
    }
  })
  const [profileQuestionIndex, setProfileQuestionIndex] = useState(0)
  const [profileSelectingOption, setProfileSelectingOption] = useState<{ questionId: number; optionIndex: number } | null>(null)
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<CourseCategory>('all')
  const [searchText, setSearchText] = useState('')
  const [coursePage, setCoursePage] = useState<CoursePageState | null>(null)
  const [videoDuration, setVideoDuration] = useState<string>('')
  const [videoProgress, setVideoProgress] = useState<number>(0)
  const [accountTab, setAccountTab] = useState<'posts' | 'answers' | 'favorites'>('posts')
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [communityReplies, setCommunityReplies] = useState<Record<string, CommunityReply[]>>({})
  const [communityTag, setCommunityTag] = useState<CommunityTag>('全部')
  const [communitySelectedPostId, setCommunitySelectedPostId] = useState('')
  const [communityQuestionTitle, setCommunityQuestionTitle] = useState('')
  const [communityQuestionContent, setCommunityQuestionContent] = useState('')
  const [communityQuestionTag, setCommunityQuestionTag] = useState<Exclude<CommunityTag, '全部'>>('学习方法')
  const [communityReplyText, setCommunityReplyText] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityMessage, setCommunityMessage] = useState('')
  const [communityPoints, setCommunityPoints] = useState(0)
  const [communitySubmitting, setCommunitySubmitting] = useState(false)
  const [communityLastLoadedPostId, setCommunityLastLoadedPostId] = useState('')
  const [favoriteCourses, setFavoriteCourses] = useState<CourseFavorite[]>([])
  const [userStats, setUserStats] = useState({ dailyStudyMinutes: 0, learnedCourseIds: [] as number[], points: 0, postCount: 0 })
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [accountProfile, setAccountProfile] = useState<AccountProfile>({
    avatarUrl: '',
    nickname: '',
    phone: '',
    password: '',
    loading: false,
    saving: false,
    message: cloudbaseReady ? '云数据库已连接，资料可长期保存' : '当前未连接云数据库，请检查环境配置',
    editingPassword: false,
  })
  const [accountProfileLoaded, setAccountProfileLoaded] = useState(false)
  const [accountUserId, setAccountUserId] = useState(() => {
    const savedPhone = typeof window !== 'undefined' ? window.localStorage.getItem('teachingweb-session-phone') : null
    return savedPhone ?? ''
  })
  const [accountIdentityReady, setAccountIdentityReady] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessages, setAiMessages] = useState<{ role: 'assistant' | 'user'; text: string }[]>([
    { role: 'assistant', text: '你好，我是 AI 助手。你可以问我家庭教育、沟通技巧或微课推荐相关问题。' },
  ])
  const [aiError, setAiError] = useState('')
  const aiChatListRef = useRef<HTMLDivElement | null>(null)
  const aiSessionId = useMemo(() => {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : 'session'

    return `teachingweb-${randomPart}`
  }, [])

  const profileDimensions: { key: ProfileDimensionKey; label: string; courseCategory: Exclude<CourseCategory, 'all'> }[] = [
    { key: 'education', label: '教育认知', courseCategory: '理念唤醒篇' },
    { key: 'communication', label: '沟通能力', courseCategory: '沟通赋能篇' },
    { key: 'digital', label: '数字技能', courseCategory: '数字时代赋能篇' },
    { key: 'time', label: '时间投入', courseCategory: '生活教育赋能篇' },
    { key: 'emotion', label: '情绪管理', courseCategory: '心理赋能篇' },
  ]

  const calculateProfileResult = (answers: Record<number, number>): ProfileResult => {
    const dimensionTexts: Record<ProfileDimensionKey, string> = {
      education: '', communication: '', digital: '', time: '', emotion: '',
    }
    const dimensionScores: Record<ProfileDimensionKey, number> = { education: 0, communication: 0, digital: 0, time: 0, emotion: 0 }

    profileDimensions.forEach(({ key }) => {
      const questions = profileQuestions.filter((question) => question.dimension === key)
      const total = questions.reduce((sum, question) => sum + (answers[question.id] || 0), 0)
      const displayScore = Math.round((total / (questions.length * 4)) * 25)
      dimensionScores[key] = displayScore
      const average = total / questions.length
      dimensionTexts[key] = average < 2.5
        ? '数字技能较弱，建议学习基础操作微课并从一个小行动开始改善。'
        : average < 3.5
          ? '处于中等水平，可以继续巩固并补足一些细节短板。'
          : '表现较好，建议继续保持，并尝试将经验应用到更多场景。'
    })

    const totalRaw = Object.values(answers).reduce((sum, value) => sum + value, 0)
    const total = Math.round((totalRaw / 100) * 100)
    const level = total <= 45 ? '家长参与度偏低，需要加强教育意识与行动' : total <= 70 ? '中等水平，某些方面存在短板，可针对性提升' : '家长参与度较高，继续保持并发挥榜样作用'
    const change = total - profileLatestTotal
    const changeText = change === 0 ? '与上次持平' : change > 0 ? `较上次提升 +${change} 分` : `较上次下降 ${change} 分`

    const weakestDimension = profileDimensions
      .map(({ key, label }) => ({ key, label, score: dimensionScores[key] }))
      .sort((a, b) => a.score - b.score)[0]

    const recommendation = courses.find((course) => course.category === profileDimensions.find((item) => item.key === weakestDimension.key)?.courseCategory) ?? courses[0]

    return {
      total,
      dimensionScores,
      dimensionTexts,
      level,
      recommendationTitle: recommendation.title,
      recommendationHint: recommendation.shortDesc,
      change,
      changeText,
    }
  }

  const handleProfileAnswerChange = (questionId: number, optionIndex: number) => {
    setProfileSelectingOption({ questionId, optionIndex })
    setProfileAnswers((current) => ({ ...current, [questionId]: optionIndex + 1 }))
    window.setTimeout(() => {
      setProfileSelectingOption(null)
      if (profileQuestionIndex < profileQuestions.length - 1) {
        setProfileQuestionIndex((index) => index + 1)
      }
    }, 260)
  }

  const currentProfileQuestion = profileQuestions[profileQuestionIndex] ?? profileQuestions[0]
  const currentProfileAnswer = profileAnswers[currentProfileQuestion.id] ?? 0
  const answeredCount = profileQuestions.filter((question) => profileAnswers[question.id]).length
  const profileQuestionProgress = (answeredCount / profileQuestions.length) * 100
  const handleProfileNextQuestion = () => {
    if (profileQuestionIndex < profileQuestions.length - 1) {
      setProfileQuestionIndex((index) => index + 1)
    } else {
      handleProfileSubmit()
    }
  }

  const handleProfilePrevQuestion = () => {
    setProfileQuestionIndex((index) => Math.max(0, index - 1))
  }

  const handleProfileOpen = () => {
    setProfileAnswers(Object.fromEntries(profileQuestions.map((question) => [question.id, 0])) as Record<number, number>)
    setProfilePageOpen(true)
    setProfileQuestionIndex(0)
  }

  useEffect(() => {
    const payload = { answers: profileAnswers, history: profileHistory, latestTotal: profileLatestTotal, result: profileResult, questionIndex: profileQuestionIndex }
    window.localStorage.setItem('teachingweb-profile', JSON.stringify(payload))
  }, [profileAnswers, profileHistory, profileLatestTotal, profileResult, profileQuestionIndex])

  useEffect(() => {
    window.localStorage.setItem('teachingweb-profile', JSON.stringify({ answers: profileAnswers, history: profileHistory, latestTotal: profileLatestTotal, result: profileResult }))
  }, [profileAnswers, profileHistory, profileLatestTotal, profileResult])

  useEffect(() => {
    let mounted = true
    const loadProfile = async () => {
      if (!accountUserId) return
      setAccountIdentityReady(true)
      setAccountProfile((current) => ({ ...current, loading: true }))
      const remoteProfile = await getUserProfile(accountUserId)
      if (!mounted) return
      setAccountProfileLoaded(true)
      if (remoteProfile) {
        const remoteLearned = remoteProfile.learnedCourseIds ?? []
        setUserStats({
          dailyStudyMinutes: remoteProfile.dailyStudyMinutes ?? 0,
          learnedCourseIds: remoteLearned,
          points: remoteProfile.points ?? 0,
          postCount: remoteProfile.postCount ?? 0,
        })
        setAccountProfile((current) => ({
          ...current,
          avatarUrl: remoteProfile.avatarUrl?.trim() || current.avatarUrl || DEFAULT_AVATAR_URL,
          nickname: remoteProfile.nickname?.trim() || current.nickname || '未设置昵称',
          phone: remoteProfile.phone || accountUserId,
          password: remoteProfile.password || current.password,
          loading: false,
          message: `已从云数据库集合 ${cloudbaseCollectionName} 同步个人资料`,
        }))
      } else {
        setAccountProfile((current) => ({
          ...current,
          avatarUrl: current.avatarUrl || DEFAULT_AVATAR_URL,
          nickname: current.nickname?.trim() || '未设置昵称',
          phone: accountUserId,
          loading: false,
          message: cloudbaseReady ? `云端暂无个人资料，保存后会写入集合 ${cloudbaseCollectionName}` : '未检测到云数据库连接，请检查 VITE_CLOUDBASE_ENV_ID',
        }))
      }
    }

    void loadProfile()
    return () => {
      mounted = false
    }
  }, [accountUserId])

  const handleProfileSubmit = () => {
    const result = calculateProfileResult(profileAnswers)
    setProfileResult(result)
    setProfileLatestTotal(result.total)
    setProfileHistory((history) => [{ total: result.total, time: new Date().toLocaleDateString('zh-CN') }, ...history].slice(0, 5))
    setProfilePageOpen(false)
    setProfileResultPageOpen(true)
    setActiveSection('profile')
  }

  const handleProfileRetest = () => {
    setProfilePageOpen(true)
    setProfileResultPageOpen(false)
    setProfileQuestionIndex(0)
  }

  const handleProfileClose = () => setProfilePageOpen(false)
  const [profileCopied, setProfileCopied] = useState(false)

  const handleProfileResultClose = () => {
    setProfileResultPageOpen(false)
    setActiveSection('profile')
  }

  const syncUserStats = async (patch: Partial<{ dailyStudyMinutes: number; learnedCourseIds: number[]; points: number; postCount: number }>) => {
    const nextStats = {
      dailyStudyMinutes: patch.dailyStudyMinutes ?? userStats.dailyStudyMinutes,
      learnedCourseIds: patch.learnedCourseIds ?? userStats.learnedCourseIds,
      points: patch.points ?? userStats.points,
      postCount: patch.postCount ?? userStats.postCount,
    }
    setUserStats(nextStats)
    if (accountUserId) {
      await updateUserLearningStats(accountUserId, nextStats)
    }
  }

  const handleProfileCopyReport = async () => {
    if (!profileResult) return
    const summary = [
      `您的教育参与指数：${profileResult.total}分`,
      `历史对比：${profileResult.changeText}`,
      ...profileDimensions.map((dimension) => `${dimension.label}：${profileResult.dimensionScores[dimension.key]} / 25，${profileResult.dimensionTexts[dimension.key]}`),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(summary)
      setProfileCopied(true)
      window.setTimeout(() => setProfileCopied(false), 1800)
    } catch {
      setProfileCopied(false)
    }
  }

  const handleAiKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleAiSend()
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setActiveBannerIndex((currentIndex) => (currentIndex + 1) % VIDEO_BACKGROUNDS.length), 4000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const points = Number(window.localStorage.getItem('teachingweb-community-points') ?? '0')
    setCommunityPoints(points)
  }, [])

  useEffect(() => {
    let mounted = true
    const loadFavorites = async () => {
      if (!accountUserId) return
      setFavoriteLoading(true)
      const favorites = await listCourseFavorites(accountUserId)
      if (!mounted) return
      setFavoriteCourses(favorites.map((item) => ({
        id: item.id ?? '',
        userId: item.userId,
        courseId: item.courseId,
        courseTitle: item.courseTitle,
        courseCategory: item.courseCategory,
        courseDuration: item.courseDuration,
        courseDesc: item.courseDesc,
        createdAt: item.createdAt,
      })))
      setFavoriteLoading(false)
    }
    void loadFavorites()
    return () => { mounted = false }
  }, [accountUserId])

  useEffect(() => {
    let mounted = true
    const loadCommunity = async () => {
      if (!cloudbaseReady) return
      setCommunityLoading(true)
      const posts = await listCommunityPosts()
      if (!mounted) return
      if (posts.length > 0) setCommunityLastLoadedPostId(posts[0].id ?? '')
      setCommunityPosts(posts.map((post) => ({
        id: post.id ?? '',
        title: post.title,
        content: post.content,
        tag: (post.tag as CommunityTag) ?? '全部',
        authorId: post.authorId,
        authorName: post.authorName,
        authorRole: post.authorRole,
        createdAt: post.createdAt,
        acceptedReplyId: post.acceptedReplyId,
        answerCount: post.answerCount ?? 0,
        viewCount: post.viewCount ?? 0,
        likeCount: post.likeCount ?? 0,
      })))
      const repliesMap: Record<string, CommunityReply[]> = {}
      await Promise.all(posts.map(async (post) => {
        const replies = await listCommunityReplies(post.id ?? '')
        repliesMap[post.id ?? ''] = replies.map((reply) => ({
          id: reply.id ?? '',
          postId: reply.postId,
          content: reply.content,
          authorId: reply.authorId,
          authorName: reply.authorName,
          authorRole: reply.authorRole,
          createdAt: reply.createdAt,
          isAccepted: reply.isAccepted,
          likeCount: reply.likeCount ?? 0,
        }))
      }))
      if (mounted) setCommunityReplies(repliesMap)
      if (mounted) setCommunityLoading(false)
    }
    void loadCommunity()
    return () => { mounted = false }
  }, [])

  const courseSections = categories.map((category) => ({ category, items: courses.filter((course) => course.category === category) }))
  const filteredSections = courseSections.filter((section) => (activeCategory === 'all' ? true : section.category === activeCategory))
  const matchesSearch = (course: Course) => (searchText.trim() ? course.title.includes(searchText) || course.shortDesc.includes(searchText) || course.category.includes(searchText) : true)
  const openCoursePage = (course: Course) => {
    setCoursePage({ course })
    setVideoDuration('')
    setVideoProgress(0)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
  const activeCourse = coursePage?.course ?? courses[0]
  const featuredCourses = [courses[4], courses[3], courses[9]]
  const carouselTargets = [courses[3], courses[1], 'ai' as const]
  const learnedCourseIds = new Set(userStats.learnedCourseIds)
  const learnedCourseCount = learnedCourseIds.size
  const todayStudyMinutes = userStats.dailyStudyMinutes
  const accumulatedPoints = userStats.points + communityPoints
  const favoriteCourseIds = new Set(favoriteCourses.map((item) => item.courseId))
  const myPosts = communityPosts.filter((post) => post.authorId === accountUserId)
  const postedCount = Math.max(userStats.postCount, myPosts.length)
  const myAnswers = Object.values(communityReplies).flat().filter((reply) => reply.authorId === accountUserId)
  const accountTabContent = {
    posts: { title: '我的帖子', emptyText: '还没有发布帖子', count: myPosts.length },
    answers: { title: '我的回答', emptyText: '还没有提交回答', count: myAnswers.length },
    favorites: { title: '我的收藏', emptyText: '还没有收藏内容', count: favoriteCourses.length },
  } as const

  const sameModuleRecommendations = courses.filter((course) => course.category === activeCourse.category && course.id !== activeCourse.id).slice(0, 2)
  const crossModuleRecommendations = courses.filter((course) => course.category !== activeCourse.category && course.id !== activeCourse.id).slice(0, 4)
  const relatedCourses = [...sameModuleRecommendations, ...crossModuleRecommendations]
  const accountTabData = accountTabContent[accountTab]
  const handleAiSend = async () => {
    const text = aiInput.trim()
    if (!text || aiLoading) return

    setAiMessages((messages) => [...messages, { role: 'user', text }])
    setAiInput('')
    setAiLoading(true)
    setAiError('')

    try {
      const response = await fetch('/api/coze-proxy', {
       method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, userId: accountUserId }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorText = data?.error || data?.msg || `HTTP ${response.status}`
        throw new Error(errorText)
      }

      const reply = data?.reply || data?.messages?.[0]?.content || '暂时没有获取到回复，请稍后再试。'
      setAiMessages((messages) => [...messages, { role: 'assistant', text: reply }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 助手暂时连接失败，请稍后重试。'
      setAiError(message)
      setAiMessages((messages) => [...messages, { role: 'assistant', text: message }])
    } finally {
      setAiLoading(false)
    }
  }

  const handleAccountProfileChange = (field: 'avatar' | 'nickname' | 'phone' | 'password', value: string) => {
    if (field === 'phone') {
      setAccountProfile((current) => ({ ...current, phone: accountUserId, message: '手机号作为账号标识，当前不可直接修改，请切换账号后再登录' }))
      return
    }
    setAccountProfile((current) => ({ ...current, [field]: value, message: '' }))
  }

  const handleAccountAvatarUpload = async (file: File | null) => {
    if (!file) return
    try {
      const avatarUrl = await uploadAvatar(file)
      setAccountProfile((current) => ({
        ...current,
        avatarUrl,
        message: '头像已上传，点击保存即可同步到云数据库',
      }))
    } catch (error) {
      const detail = error instanceof Error ? error.message : '头像上传失败'
      setAccountProfile((current) => ({ ...current, message: `头像上传失败：${detail}` }))
    }
  }

  const handleAccountSave = async () => {
    setAccountProfile((prev) => ({ ...prev, saving: true, message: '' }))

    const cleanPassword = (pwd: string): string => pwd.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s/g, '')
    const nextProfile = {
      id: accountUserId,
      avatarUrl: accountProfile.avatarUrl || DEFAULT_AVATAR_URL,
      nickname: accountProfile.nickname.trim() || '未设置昵称',
      phone: accountUserId,
      password: cleanPassword(accountProfile.password) || undefined,
      updatedAt: new Date().toISOString(),
    }

    try {
      const saved = await saveUserProfile(nextProfile)
      if (typeof saved === 'boolean' ? !saved : !saved.ok) {
        throw new Error(saved.error || '保存失败')
      }
      const reloaded = await getUserProfile(accountUserId)
      if (!reloaded?.phone) throw new Error('保存后读取失败')

      setAccountProfile((current) => ({
        ...current,
        avatarUrl: reloaded.avatarUrl || nextProfile.avatarUrl,
        nickname: reloaded.nickname || nextProfile.nickname,
        phone: reloaded.phone,
        password: reloaded.password || nextProfile.password || current.password || '',
        loading: false,
        saving: false,
        message: '已保存并同步到腾讯云数据库',
        editingPassword: false,
      }))
    } catch (error) {
      const detail = error instanceof Error ? error.message : '保存失败'
      setAccountProfile((prev) => ({ ...prev, saving: false, message: `保存失败：${detail}` }))
    }
  }

  
  const handleAuthSubmit = async () => {
    setAuthError('')
    const nickname = authNickname.trim()
    const phone = authPhone.trim()
    const rawPassword = authPassword
    const rawConfirmPassword = authConfirmPassword

    // 基础校验
    if (!phone) {
      setAuthError('请输入手机号')
      return
    }
    if (!rawPassword) {
      setAuthError('请输入密码')
      return
    }
    if (!/^\d{11}$/.test(phone)) {
      setAuthError('手机号必须是11位数字')
      return
    }

    // 辅助函数：清洗密码（去除首尾空格、零宽空格、所有空白字符）
    const cleanPassword = (pwd: string): string => {
      return pwd
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s/g, '')
    }

    const password = cleanPassword(rawPassword)

    if (authMode === 'register') {
      if (!nickname) {
        setAuthError('注册时请输入昵称')
        return
      }
      if (password.length < 6) {
        setAuthError('密码至少需要 6 位')
        return
      }
      const confirmPassword = cleanPassword(rawConfirmPassword)
      if (password !== confirmPassword) {
        setAuthError('两次输入的密码不一致')
        return
      }
    }

    setAuthLoading(true)

    try {
      const storageKey = `teachingweb-auth-profile-${phone}`

      // ---------- 注册 ----------
      if (authMode === 'register') {
        // 检查是否已存在（通过手机号）
        const existing = await getUserProfile(phone)
        if (existing) {
          throw new Error('该手机号已注册，请直接登录')
        }

        const nextProfile = {
          id: phone,
          phone,
          avatarUrl: DEFAULT_AVATAR_URL,
          nickname,
          password,                      // 使用清洗后的密码
          updatedAt: new Date().toISOString(),
        }
        const saved = await saveUserProfile(nextProfile)
        if (typeof saved === 'boolean' ? !saved : !saved.ok) {
          throw new Error('云数据库写入失败，请检查权限设置')
        }
        const verified = await getUserProfile(phone)
        if (!verified?.phone) {
          throw new Error('云端写入后未检测到文档，请检查数据库权限')
        }

        // 保存会话
        window.localStorage.setItem('teachingweb-session-phone', phone)
        window.localStorage.setItem(storageKey, JSON.stringify({
          id: nextProfile.id,
          phone: nextProfile.phone,
          nickname: nextProfile.nickname,
          updatedAt: nextProfile.updatedAt,
        }))
        setAccountUserId(phone)
        setAccountProfile({
          avatarUrl: nextProfile.avatarUrl,
          nickname: nextProfile.nickname,
          phone: nextProfile.phone,
          password: nextProfile.password ?? '',
          loading: false,
          saving: false,
          message: '注册成功，已创建文档',
          editingPassword: false,
        })
        setAuthResolved(true)
        setAccountProfileLoaded(true)
        setActiveSection('home')
        return
      }

      // ---------- 登录 ----------
      // 直接调用 verifyUser，在数据库层面同时匹配 phone 和清洗后的 password
      const cloudProfile = await verifyUser(phone, rawPassword)
      if (!cloudProfile) {
        throw new Error('账号或密码错误')
      }

      // 登录成功，保存会话
      window.localStorage.setItem('teachingweb-session-phone', phone)
      window.localStorage.setItem(storageKey, JSON.stringify({
        id: cloudProfile.id,
        phone: cloudProfile.phone,
        nickname: cloudProfile.nickname,
        updatedAt: cloudProfile.updatedAt,
      }))
      setAccountUserId(phone)
      setAccountProfile({
        avatarUrl: cloudProfile.avatarUrl ?? DEFAULT_AVATAR_URL,
        nickname: cloudProfile.nickname ?? nickname,
        phone: cloudProfile.phone,
        password: cloudProfile.password ?? '',
        loading: false,
        saving: false,
        message: '登录成功',
        editingPassword: false,
      })
      setAuthResolved(true)
      setAccountProfileLoaded(true)
      setActiveSection('home')
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录注册失败，请稍后再试'
      setAuthError(message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem('teachingweb-session-phone')
    setCoursePage(null)
    setProfilePageOpen(false)
    setProfileResultPageOpen(false)
    setAccountUserId('')
    setAccountProfileLoaded(false)
    setAccountProfile({
      avatarUrl: '',
      nickname: '',
      phone: '',
      password: '',
      loading: false,
      saving: false,
      message: cloudbaseReady ? '云数据库已连接，资料可长期保存' : '当前未连接云数据库，请检查环境配置',
      editingPassword: false,
    })
    setAuthMode('login')
    setAuthNickname('')
    setAuthPhone('')
    setAuthPassword('')
    setAuthConfirmPassword('')
    setAuthShowPassword(false)
    setAuthError('')
    setAuthResolved(false)
  }


  const handleAccountPasswordToggle = () => {
    setAccountProfile((current) => ({ ...current, editingPassword: !current.editingPassword, message: '' }))
  }


  const selectedCommunityPost = communityPosts.find((post) => post.id === communitySelectedPostId)
    ?? communityPosts.find((post) => post.id === communityLastLoadedPostId)
    ?? communityPosts[0]
    ?? null
  const visibleCommunityPosts = communityPosts.filter((post) => communityTag === '全部' ? true : post.tag === communityTag)
  const selectedCommunityReplies = selectedCommunityPost ? (communityReplies[selectedCommunityPost.id] ?? []) : []

  const handleCommunityCreatePost = async () => {
    if (!communityQuestionTitle.trim() || !communityQuestionContent.trim()) {
      setCommunityMessage('请填写标题和内容')
      return
    }
    setCommunitySubmitting(true)
    const result = await createCommunityPost({
      title: communityQuestionTitle.trim(),
      content: communityQuestionContent.trim(),
      tag: communityQuestionTag,
      authorId: accountUserId,
      authorName: accountProfile.nickname || '家长用户',
      authorRole: '家长',
    })
    if (result.ok && result.id) {
      const storedPost = await listCommunityPosts()
      setCommunityPosts(storedPost.map((post) => ({
        id: post.id ?? '',
        title: post.title,
        content: post.content,
        tag: post.tag as CommunityTag,
        authorId: post.authorId,
        authorName: post.authorName,
        authorRole: post.authorRole,
        createdAt: post.createdAt,
        acceptedReplyId: post.acceptedReplyId,
        answerCount: post.answerCount ?? 0,
        viewCount: post.viewCount ?? 0,
        likeCount: post.likeCount ?? 0,
      })))
      await syncUserStats({ postCount: myPosts.length + 1 })
      const newPostId = result.id ?? ''
      setCommunitySelectedPostId(newPostId)
      setCommunityReplies((current) => ({ ...current, [newPostId as string]: [] }))
      setCommunityQuestionTitle('')
      setCommunityQuestionContent('')
      setCommunityMessage('问题已发布，已同步到云数据库')
    } else {
      setCommunityMessage(`发布失败：${result.error}`)
    }
    setCommunitySubmitting(false)
  }

  const handleCommunityReply = async () => {
    if (!selectedCommunityPost || !communityReplyText.trim()) return
    setCommunitySubmitting(true)
    const result = await createCommunityReply({
      postId: selectedCommunityPost.id,
      content: communityReplyText.trim(),
      authorId: accountUserId,
      authorName: accountProfile.nickname || '家长用户',
      authorRole: '家长',
    })
    if (result.ok && result.id) {
      const refreshedReplies = await listCommunityReplies(selectedCommunityPost.id)
      const refreshedPosts = await listCommunityPosts()
      setCommunityReplies((current) => ({
        ...current,
        [selectedCommunityPost.id]: refreshedReplies.map((reply) => ({
          id: reply.id ?? '',
          postId: reply.postId,
          content: reply.content,
          authorId: reply.authorId,
          authorName: reply.authorName,
          authorRole: reply.authorRole,
          createdAt: reply.createdAt,
          isAccepted: reply.isAccepted,
          likeCount: reply.likeCount ?? 0,
        })),
      }))
      setCommunityPosts(refreshedPosts.map((post) => ({
        id: post.id ?? '',
        title: post.title,
        content: post.content,
        tag: post.tag as CommunityTag,
        authorId: post.authorId,
        authorName: post.authorName,
        authorRole: post.authorRole,
        createdAt: post.createdAt,
        acceptedReplyId: post.acceptedReplyId,
        answerCount: post.answerCount ?? 0,
        viewCount: post.viewCount ?? 0,
        likeCount: post.likeCount ?? 0,
      })))
      await syncUserStats({ postCount: myPosts.length + 1 })
      setCommunityReplyText('')
      setCommunityMessage('回复已发送，已同步到云数据库')
    } else {
      setCommunityMessage(`回复失败：${result.error}`)
    }
    setCommunitySubmitting(false)
  }

  const handleCommunityAcceptReply = async (replyId: string) => {
    if (!selectedCommunityPost) return
    const result = await acceptCommunityReply(selectedCommunityPost.id, replyId)
    if (result.ok) {
      const refreshedPosts = await listCommunityPosts()
      const refreshedReplies = await listCommunityReplies(selectedCommunityPost.id)
      setCommunityPosts(refreshedPosts.map((post) => ({
        id: post.id ?? '',
        title: post.title,
        content: post.content,
        tag: post.tag as CommunityTag,
        authorId: post.authorId,
        authorName: post.authorName,
        authorRole: post.authorRole,
        createdAt: post.createdAt,
        acceptedReplyId: post.acceptedReplyId,
        answerCount: post.answerCount ?? 0,
        viewCount: post.viewCount ?? 0,
        likeCount: post.likeCount ?? 0,
      })))
      setCommunityReplies((current) => ({
        ...current,
        [selectedCommunityPost.id]: refreshedReplies.map((reply) => ({
          id: reply.id ?? '',
          postId: reply.postId,
          content: reply.content,
          authorId: reply.authorId,
          authorName: reply.authorName,
          authorRole: reply.authorRole,
          createdAt: reply.createdAt,
          isAccepted: reply.isAccepted,
          likeCount: reply.likeCount ?? 0,
        })),
      }))
      setCommunityPoints((points) => {
        const next = points + 10
        window.localStorage.setItem('teachingweb-community-points', String(next))
        return next
      })
      setCommunityMessage('已采纳最佳答案，回答者获得 10 积分')
    } else {
      setCommunityMessage(`采纳失败：${result.error}`)
    }
  }

  const refreshFavoriteCourses = async () => {
    if (!accountUserId) return
    setFavoriteLoading(true)
    const favorites = await listCourseFavorites(accountUserId)
    setFavoriteCourses(favorites.map((item) => ({
      id: item.id ?? '',
      userId: item.userId,
      courseId: item.courseId,
      courseTitle: item.courseTitle,
      courseCategory: item.courseCategory,
      courseDuration: item.courseDuration,
      courseDesc: item.courseDesc,
      createdAt: item.createdAt,
    })))
    setFavoriteLoading(false)
  }

  const handleFavoriteCourse = async (course: Course) => {
    if (!accountUserId) return
    const exists = favoriteCourseIds.has(course.id)
    setFavoriteLoading(true)
    if (exists) {
      const result = await removeCourseFavorite(accountUserId, course.id)
      if (!result.ok) {
        setFavoriteLoading(false)
        return
      }
      await refreshFavoriteCourses()
      setFavoriteLoading(false)
      return
    }

    const result = await addCourseFavorite({
      userId: accountUserId,
      courseId: course.id,
      courseTitle: course.title,
      courseCategory: course.category,
      courseDuration: course.duration,
      courseDesc: course.shortDesc,
    })
    if (result.ok) {
      await refreshFavoriteCourses()
    }
    setFavoriteLoading(false)
  }

  const handleFavoriteItemClick = (courseId: number) => {
    const course = courses.find((item) => item.id === courseId)
    if (course) setCoursePage({ course })
  }

  useEffect(() => {
    const list = aiChatListRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  const renderModuleCard = (course: Course) => (
    <button key={course.id} className="module-course-card static-card" onClick={() => openCoursePage(course)}>
      <div className="course-thumb" aria-hidden="true">▶</div>
      <div className="course-content">
        <div className="course-title-row">
          <h3>{course.title}</h3>
          {course.isLearned ? <span className="learned-badge">已学</span> : null}
        </div>
        <p>{course.shortDesc}</p>
        <div className="course-meta">
          <span className="meta-tag">#{course.category}</span>
          <span className="meta-time">{course.duration}</span>
        </div>
        <div className="course-progress-line"><div className="course-progress-fill" style={{ width: `${course.progress}%` }} /></div>
        <small>进度 {course.progress}%</small>
      </div>
    </button>
  )

  const handleVideoLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const totalSeconds = event.currentTarget.duration
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return

    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    setVideoDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`)
  }

  const handleVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    setVideoProgress((video.currentTime / video.duration) * 100)
  }

  const handleVideoEnded = () => {
    setVideoProgress(100)
  }

  const markCourseAsLearned = async (course: Course) => {
    if (!accountUserId) return
    const exists = userStats.learnedCourseIds.includes(course.id)
    const nextCourseIds = exists
      ? userStats.learnedCourseIds.filter((id) => id !== course.id)
      : Array.from(new Set([...userStats.learnedCourseIds, course.id]))
    await syncUserStats({
      learnedCourseIds: nextCourseIds,
      dailyStudyMinutes: Math.max(userStats.dailyStudyMinutes, Math.max(1, Math.round(Math.max(videoProgress || course.progress, course.progress) / 5))),
      points: exists ? userStats.points : userStats.points + 5,
    })
  }

  const renderCoursePlayerPage = () => (
    <section className="player-page">
      <button className="back-button" onClick={() => setCoursePage(null)}>‹ 返回微课列表</button>
      <div className="player-card">
        <div className="player-video">
          <video
            key={activeCourse.id}
            className="player-video-element"
            controls
            autoPlay
            playsInline
            poster={VIDEO_BACKGROUNDS[(activeCourse.id - 1) % VIDEO_BACKGROUNDS.length]}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
          >
            <source src={videoMap[activeCourse.id]} type="video/mp4" />
            您的浏览器不支持视频播放。
          </video>
        </div>
        <div className="player-info">
          <div className="player-meta-row">
            <span className="player-tag">{activeCourse.category}</span>
            <span className="player-time">{videoDuration || activeCourse.duration}</span>
          </div>
          <h1>{activeCourse.title}</h1>
          <p className="player-desc">{activeCourse.shortDesc}</p>
          <div className="player-progress">
            <div className="player-progress-head"><span>学习进度</span><strong>{Math.round(videoProgress || activeCourse.progress)}%</strong></div>
            <div className="progress-track slim"><div className="progress-fill" style={{ width: `${videoProgress || activeCourse.progress}%` }} /></div>
          </div>
          <div className="player-action-row">
            <button
              type="button"
              className={favoriteCourseIds.has(activeCourse.id) ? 'player-favorite-button active' : 'player-favorite-button'}
              onClick={() => void handleFavoriteCourse(activeCourse)}
            >
              {favoriteCourseIds.has(activeCourse.id) ? '已收藏' : '收藏课程'}
            </button>
            <button className={userStats.learnedCourseIds.includes(activeCourse.id) ? 'player-finish-button active' : 'player-finish-button'} onClick={() => void markCourseAsLearned(activeCourse)}>{userStats.learnedCourseIds.includes(activeCourse.id) ? '已学完' : '标记为已学完'}</button>
          </div>
          <section className="player-related">
            <h2>相关推荐</h2>
            <div className="player-related-list">
              {relatedCourses.map((course) => (
                <button key={course.id} className="player-related-card" onClick={() => openCoursePage(course)}>
                  <div className="player-related-thumb">▶</div>
                  <div>
                    <strong>{course.title}</strong>
                    <span>{course.duration}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )

  if (!authResolved || !accountUserId) {
    return (
      <div className="app-shell auth-shell">
        <main className="content-wrap auth-wrap">
          <section className="auth-card">
            <div className="auth-hero">
              <p className="panel-kicker">欢迎使用</p>
              <h1>登录或注册后进入平台</h1>
              <p>新用户请先注册，注册成功后自动进入首页。每个手机号对应云数据库中的独立文档，互不影响。</p>
            </div>
            <div className="auth-side">
              <div className="auth-badge">账号安全与云同步</div>
              <div className="auth-points">
                <div className="auth-point"><strong>独立账户</strong><span>每个手机号对应一个独立文档，个人资料互不干扰。</span></div>
                <div className="auth-point"><strong>云端保存</strong><span>注册和修改都会同步到云数据库，便于长期保存。</span></div>
                <div className="auth-point"><strong>登录即首页</strong><span>登录后自动进入网站首页，开始使用微课与个人中心。</span></div>
              </div>
              <div className="auth-highlight">如果你已经注册过账号，请直接切换到登录；如果是第一次使用，请先完成注册。</div>
            </div>
            <div className="auth-tabs">
              <button className={authMode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('login'); setAuthError('') }}>登录</button>
              <button className={authMode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('register'); setAuthError('') }}>注册</button>
            </div>
            <div className="auth-form">
              {authMode === 'register' ? (
                <label className="account-form-field"><span>昵称</span><input autoComplete="off" spellCheck={false} value={authNickname} onChange={(e) => setAuthNickname(e.target.value)} placeholder="请输入昵称" /></label>
              ) : null}
              <label className="account-form-field"><span>账号（手机号）</span><input autoComplete="off" inputMode="numeric" spellCheck={false} value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} placeholder="请输入手机号" /></label>
              <label className="account-form-field"><span>密码</span><div className="auth-password-row"><input autoComplete="new-password" type={authShowPassword ? 'text' : 'password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="请输入密码" /><button type="button" className="auth-password-toggle account-edit-btn" onClick={() => setAuthShowPassword((current) => !current)}>{authShowPassword ? '隐藏' : '显示'}</button></div></label>
              {authMode === 'register' ? <label className="account-form-field"><span>确认密码</span><input autoComplete="new-password" type={authShowPassword ? 'text' : 'password'} value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="请再次输入密码" /></label> : null}
              {authError ? <div className="ai-error-tip">{authError}</div> : null}
              <button className="profile-primary-button" onClick={() => void handleAuthSubmit()} disabled={authLoading}>{authLoading ? '处理中…' : authMode === 'register' ? '注册并进入' : '登录进入'}</button>
            </div>
          </section>
        </main>
      </div>
    )
  }


  if (coursePage) {
    return <div className="app-shell"><header className="site-header"><div className="main-nav"><div className="brand-wrap"><div className="brand-icon" aria-hidden="true">⬢</div><div className="brand-text">家长教育智慧平台</div></div><div className="nav-center single-title">{activeCourse.title}</div><div className="nav-right" aria-hidden="true"><span className="search-dot" /></div></div></header><main className="content-wrap player-wrap">{renderCoursePlayerPage()}</main></div>
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="main-nav">
          <div className="brand-wrap">
            <div className="brand-icon" aria-hidden="true">⬢</div>
            <div className="brand-text">家长教育智慧平台</div>
          </div>
          <nav className="nav-center" aria-label="主导航">
            {sections.map((section) => <button key={section.key} className={activeSection === section.key ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection(section.key)}>{section.label}</button>)}
          </nav>
          <div className="nav-right" aria-hidden="true"><span className="search-dot" /></div>
        </div>
      </header>
      <main className="content-wrap">
        {activeSection === 'courses' ? (
          <section className="course-page">
            <div className="course-header"><p className="panel-kicker">微课学习</p><h1>微课学习 · 家长课堂</h1><p>点击任意微课卡片后，将进入对应的专门视频播放页面，并在视频下方展示课程信息与相关推荐。</p></div>
            <div className="search-row"><span className="search-icon" aria-hidden="true">⌕</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索课程标题或关键词" aria-label="搜索课程标题或关键词" /></div>
            <div className="category-tabs" role="tablist" aria-label="课程分类"><button className={activeCategory === 'all' ? 'category-tab active' : 'category-tab'} onClick={() => setActiveCategory('all')}>全部模块</button>{categories.map((category) => <button key={category} className={activeCategory === category ? 'category-tab active' : 'category-tab'} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
            <div className="tab-line" aria-hidden="true"><span className="tab-line-fill" style={{ width: `${activeCategory === 'all' ? 0 : (categories.indexOf(activeCategory as Exclude<CourseCategory, 'all'>) / (categories.length - 1 || 1)) * 100}%` }} /></div>
            <div className="module-list">{filteredSections.map((section) => { const sectionCourses = section.items.filter(matchesSearch); if (sectionCourses.length === 0) return null; return (<section key={section.category} className="module-block"><div className="panel-head module-head"><div><h2>{section.category}</h2></div><span className="panel-badge">{sectionCourses.length} 门课程</span></div><div className="module-course-grid">{sectionCourses.map(renderModuleCard)}</div></section>) })}</div>
          </section>
        ) : activeSection === 'profile' && !profilePageOpen && !profileResultPageOpen ? (
          <section className="profile-page">
            <div className="profile-hero-card">
              <div>
                <p className="panel-kicker">教育画像</p>
                <h1>教育参与画像 · 认识您的教育短板</h1>
                <p>通过简洁问卷帮助家长了解自身教育参与现状，生成针对性建议和推荐学习路径。</p>
              </div>
              <button className="profile-primary-button" onClick={handleProfileOpen}>测评</button>
            </div>
          </section>
        ) : activeSection === 'profile' && profilePageOpen ? (
          <section className="profile-page">
            <div className="profile-question-page">
              <div className="profile-question-page-head">
                <button className="back-button" onClick={handleProfileClose}>‹ 返回画像页</button>
                <div>
                  <p className="panel-kicker">专门答题页面</p>
                  <h2>分步完成 25 题画像测评</h2>
                  <p>你可以逐题作答，也可以通过右侧导航快速跳题，提交后系统将自动生成画像报告。</p>
                </div>
              </div>

              <div className="profile-question-page-layout">
                <section className="profile-question-main-card">
                  <div className="profile-step-bar"><div className="profile-step-fill" style={{ width: `${profileQuestionProgress}%` }} /></div>
                  <div className="profile-step-head"><span>第 {profileQuestionIndex + 1} 题 / 共 {profileQuestions.length} 题</span><strong>{profileDimensions.find((dimension) => dimension.key === currentProfileQuestion.dimension)?.label}</strong></div>
                  <div key={currentProfileQuestion.id} className="profile-question-item current-question profile-question-animated">
                    <h3>{currentProfileQuestion.id}. {currentProfileQuestion.prompt}</h3>
                    <div className="profile-option-list single-question">
                      {currentProfileQuestion.options.map((option, index) => {
                        const isSelected = currentProfileAnswer === index + 1
                        const isSelecting = profileSelectingOption?.questionId === currentProfileQuestion.id && profileSelectingOption.optionIndex === index
                        return (
                          <button type="button" key={option} className={isSelected ? 'profile-option active' : isSelecting ? 'profile-option selecting' : 'profile-option'} onClick={() => handleProfileAnswerChange(currentProfileQuestion.id, index)}>
                            {String.fromCharCode(65 + index)}. {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="profile-modal-footer">
                    <button type="button" className="profile-secondary-button" onClick={handleProfilePrevQuestion} disabled={profileQuestionIndex === 0}>上一题</button>
                    {profileQuestionIndex < profileQuestions.length - 1 ? (
                      <button type="button" className="profile-primary-button" onClick={handleProfileNextQuestion}>下一题</button>
                    ) : (
                      <button type="button" className="profile-primary-button" onClick={handleProfileSubmit}>提交并生成报告</button>
                    )}
                  </div>
                </section>
                <aside className="profile-question-nav-panel">
                  <p className="panel-kicker">题目导航</p>
                  <div className="profile-question-nav">
                    {profileQuestions.map((question, index) => {
                      const isActive = index === profileQuestionIndex
                      const answered = Boolean(profileAnswers[question.id])
                      return (
                        <button type="button" key={question.id} className={isActive ? 'profile-nav-item active' : answered ? 'profile-nav-item answered' : 'profile-nav-item'} onClick={() => setProfileQuestionIndex(index)}>
                          {question.id}
                        </button>
                      )
                    })}
                  </div>
                  <div className="profile-nav-note">可点击任意题号回看并修改答案</div>
                </aside>
              </div>
            </div>
          </section>
        ) : activeSection === 'profile' && profileResultPageOpen ? (
          <section className="profile-page">
            <div className="profile-question-page">
              <div className="profile-question-page-head">
                <button className="back-button" onClick={handleProfileResultClose}>‹ 返回画像页</button>
                <div>
                  <p className="panel-kicker">我的画像测试结果报告</p>
                  <h2>您的教育参与指数：{profileResult?.total ?? profileLatestTotal}分</h2>
                  <p>{profileResult?.level ?? '完成测评后即可查看报告'}</p>
                </div>
              </div>

              <section className="profile-summary-card">
                <div className="profile-score-box">
                  <span className="profile-score-label">综合得分</span>
                  <strong className="profile-score-animated">{profileResult?.total ?? profileLatestTotal}分</strong>
                  <small>{profileResult?.level ?? '完成问卷后即可生成报告'}</small>
                </div>
                <div className="profile-history-box">
                  <p className="panel-kicker">历史对比</p>
                  {profileHistory.map((item, index) => (
                    <div key={`${item.time}-${index}`} className="profile-history-row">
                      <span>{item.time}</span>
                      <strong>{item.total}分</strong>
                      {index === 0 && profileResult ? <em>{profileResult.changeText}</em> : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="profile-dimension-card">
                <div className="panel-head"><div><p className="panel-kicker">五大维度</p><h2>雷达图与维度解读</h2></div><span className="panel-badge">真实得分绘制</span></div>
                <div className="profile-radar-wrap">
                  <div className="profile-radar-chart" aria-hidden="true">
                    <svg viewBox="0 0 420 420" role="img" aria-label="五大维度雷达图">
                      {[
                        { radius: 170, className: 'radar-grid' },
                        { radius: 128, className: 'radar-grid secondary' },
                        { radius: 86, className: 'radar-grid tertiary' },
                      ].map((ring) => (
                        <polygon
                          key={ring.radius}
                          points={profileDimensions.map((_, index) => {
                            const angle = (-Math.PI / 2) + index * (Math.PI * 2 / profileDimensions.length)
                            return `${210 + Math.cos(angle) * ring.radius},${210 + Math.sin(angle) * ring.radius}`
                          }).join(' ')}
                          className={ring.className}
                        />
                      ))}
                      <polygon
                        points={profileDimensions.map((dimension, index) => {
                          const score = profileResult?.dimensionScores[dimension.key] ?? 0
                          const ratio = Math.max(0, Math.min(score / 25, 1))
                          const angle = (-Math.PI / 2) + index * (Math.PI * 2 / profileDimensions.length)
                          const radius = 40 + ratio * 118
                          return `${210 + Math.cos(angle) * radius},${210 + Math.sin(angle) * radius}`
                        }).join(' ')}
                        className="radar-value"
                      />
                      {profileDimensions.map((dimension, index) => {
                        const score = profileResult?.dimensionScores[dimension.key] ?? 0
                        const ratio = Math.max(0, Math.min(score / 25, 1))
                        const angle = (-Math.PI / 2) + index * (Math.PI * 2 / profileDimensions.length)
                        const pointRadius = 40 + ratio * 118
                        const labelRadius = 178
                        const pointX = 210 + Math.cos(angle) * pointRadius
                        const pointY = 210 + Math.sin(angle) * pointRadius
                        const labelX = 210 + Math.cos(angle) * labelRadius
                        const labelY = 210 + Math.sin(angle) * labelRadius
                        const labelAnchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
                        return (
                          <g key={dimension.key}>
                            <circle cx={pointX} cy={pointY} r="7" className="radar-point" />
                            <text x={labelX} y={labelY} textAnchor={labelAnchor} dominantBaseline="middle" className="radar-label">
                              {dimension.label}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                  <div className="profile-dimension-list">
                    {profileDimensions.map((dimension) => {
                      const score = profileResult?.dimensionScores[dimension.key] ?? 0
                      return (
                        <button key={dimension.key} type="button" className="profile-dimension-item" onClick={() => { setActiveSection('courses'); setActiveCategory(dimension.courseCategory); setProfileResultPageOpen(false) }}>
                          <div className="profile-dimension-head">
                            <strong>{dimension.label}</strong>
                            <span>{score} / 25</span>
                          </div>
                          <p>{profileResult?.dimensionTexts[dimension.key] ?? '完成测评后显示具体建议。'}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>

              <section className="profile-actions-card">
                <div className="panel-head"><div><p className="panel-kicker">推荐学习</p><h2>点击维度跳转到对应微课</h2></div></div>
                <div className="profile-course-links">
                  {profileDimensions.map((dimension) => {
                    const course = courses.find((item) => item.category === dimension.courseCategory)
                    return course ? (
                      <button key={dimension.key} className="profile-course-link" onClick={() => { setActiveSection('courses'); setActiveCategory(dimension.courseCategory); setProfileResultPageOpen(false) }}>
                        <span>{dimension.label}</span>
                        <strong>{course.title}</strong>
                      </button>
                    ) : null
                  })}
                </div>
              </section>

              {profileResult ? (
                <section className="profile-report-card">
                  <div className="panel-head"><div><p className="panel-kicker">画像报告</p><h2>维度解读与行动建议</h2></div><button className="profile-secondary-button" onClick={handleProfileRetest}>重新测评</button></div>
                  <div className="profile-report-grid">
                    {profileDimensions.map((dimension) => (
                      <div key={dimension.key} className="profile-report-item">
                        <div className="profile-report-head">
                          <strong>{dimension.label}</strong>
                          <span>{profileResult.dimensionScores[dimension.key]}分</span>
                        </div>
                        <p>{profileResult.dimensionTexts[dimension.key]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="profile-report-footer">
                    <div>
                      <p className="panel-kicker">总体建议</p>
                      <h3>{profileResult.recommendationTitle}</h3>
                      <p>{profileResult.recommendationHint}</p>
                    </div>
                    <div className="profile-report-actions">
                      <button type="button" className="profile-secondary-button" onClick={handleProfileCopyReport}>{profileCopied ? '已复制' : '复制报告'}</button>
                      <button className="profile-primary-button" onClick={() => { setActiveSection('courses'); setActiveCategory('all'); setProfileResultPageOpen(false) }}>去微课学习</button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        ) : activeSection === 'community' ? (
          <section className="community-page">
            <div className="community-hero-card">
              <div>
                <p className="panel-kicker">交流圈 · 家长互助 + 志愿者答疑</p>
                <h1>这里是家长们的互助社区，可以提问、分享经验</h1>
                <p>发布问题、选择标签、互相回答，提问者还可以采纳最佳答案并为帮助者发放积分。</p>
              </div>
              <div className="community-hero-stats">
                <div><strong>{communityPosts.length}</strong><span>问题</span></div>
                <div><strong>{communityReplies ? Object.values(communityReplies).flat().length : 0}</strong><span>回答</span></div>
                <div><strong>{communityPoints}</strong><span>积分</span></div>
              </div>
            </div>
            <div className="community-top-card">
              <button className={communityTag === '全部' ? 'community-tag active' : 'community-tag'} onClick={() => setCommunityTag('全部')}>全部</button>
              {(['学习方法', '心理困惑', '沟通问题', '政策咨询', '志愿者答疑'] as Exclude<CommunityTag, '全部'>[]).map((tag) => <button key={tag} className={communityTag === tag ? 'community-tag active' : 'community-tag'} onClick={() => setCommunityTag(tag)}>{tag}</button>)}
            </div>
            <div className="community-layout">
              <section className="community-post-list-card">
                <div className="panel-head"><div><h2>问题列表</h2><p className="profile-report-page-note">按标签筛选，点击查看详情与回答</p></div><button className="profile-primary-button" onClick={() => document.getElementById('community-question-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>+ 提问</button></div>
                {communityLoading ? <div className="community-empty">正在加载社区内容…</div> : null}
                <div className="community-post-list">
                  {visibleCommunityPosts.map((post) => (
                    <button key={post.id} className={selectedCommunityPost?.id === post.id ? 'community-post-card active' : 'community-post-card'} onClick={() => setCommunitySelectedPostId(post.id)}>
                      <div className="community-post-head"><strong>{post.title}</strong><span>{post.tag}</span></div>
                      <p>{post.content}</p>
                      <div className="community-post-meta"><span>{post.authorName} · {post.authorRole}</span><span>{post.answerCount} 回答</span></div>
                    </button>
                  ))}
                  {!communityLoading && visibleCommunityPosts.length === 0 ? <div className="community-empty">当前暂无内容，快来发布第一条提问吧。</div> : null}
                </div>
              </section>
              <aside className="community-detail-card">
                <div className="community-post-detail">
                  <h2>{selectedCommunityPost?.title || '请选择一个问题'}</h2>
                  <div className="community-detail-meta">
                    <span>{selectedCommunityPost?.tag || '全部'}</span>
                    <span>{selectedCommunityPost?.authorName || '—'}</span>
                    <span>{selectedCommunityReplies.length} 条回答</span>
                  </div>
                  <p>{selectedCommunityPost?.content || '左侧选择一个问题，查看详情并参与回答。'}</p>
                </div>
                <div className="community-reply-list">
                  {selectedCommunityReplies.map((reply) => (
                    <div key={reply.id} className={reply.isAccepted ? 'community-reply-card accepted' : 'community-reply-card'}>
                      <div className="community-reply-head"><strong>{reply.authorName}</strong><span>{reply.authorRole}</span></div>
                      <p>{reply.content}</p>
                      <div className="community-reply-actions">
                        <span>{reply.isAccepted ? '已采纳' : '普通回答'}</span>
                        {selectedCommunityPost?.authorId === accountUserId && !reply.isAccepted ? <button className="account-edit-btn" onClick={() => void handleCommunityAcceptReply(reply.id)}>采纳最佳答案</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="community-reply-form">
                  <textarea value={communityReplyText} onChange={(e) => setCommunityReplyText(e.target.value)} placeholder="写下你的回复，帮助其他家长" />
                  <button className="profile-primary-button" onClick={() => void handleCommunityReply()} disabled={communitySubmitting || !communityReplyText.trim()}>发送回答</button>
                </div>
              </aside>
            </div>
            <section className="community-create-card" id="community-question-form">
              <div className="panel-head"><div><p className="panel-kicker">发布问题</p><h2>提问并选择标签</h2></div></div>
              <div className="community-create-grid">
                <label className="account-form-field"><span>问题标题</span><input value={communityQuestionTitle} onChange={(e) => setCommunityQuestionTitle(e.target.value)} placeholder="例如：孩子写作业拖拉怎么办？" /></label>
                <label className="account-form-field"><span>标签</span><select value={communityQuestionTag} onChange={(e) => setCommunityQuestionTag(e.target.value as Exclude<CommunityTag, '全部'>)}><option value="学习方法">学习方法</option><option value="心理困惑">心理困惑</option><option value="沟通问题">沟通问题</option><option value="政策咨询">政策咨询</option><option value="志愿者答疑">志愿者答疑</option></select></label>
                <label className="account-form-field community-create-full"><span>问题内容</span><textarea value={communityQuestionContent} onChange={(e) => setCommunityQuestionContent(e.target.value)} placeholder="把你的情况简单说清楚，越具体越容易获得有效帮助" /></label>
              </div>
              <div className="community-create-footer">
                <span>{communityMessage || '支持家长与志愿者共同参与，提问后即可看到回复。'}</span>
                <button className="profile-primary-button" onClick={() => void handleCommunityCreatePost()} disabled={communitySubmitting}>{communitySubmitting ? '发布中…' : '发布问题'}</button>
              </div>
            </section>
          </section>
        ) : activeSection === 'account' ? (
          <section className="account-page">
            <div className="account-page-head">
              <p className="panel-kicker">个人中心</p>
              <h1>个人中心 · 我的成长档案</h1>
              <p>在这里可以修改头像、昵称、手机号和密码，保存后会同步到云数据库。当前账号：{accountUserId}{accountIdentityReady ? '' : '（识别中）'}</p>
              <div className="account-page-actions">
                <button type="button" className="account-edit-btn" onClick={handleLogout}>退出登录</button>
                <span>{accountProfileLoaded ? '已完成账号同步' : '正在同步账号信息…'}</span>
              </div>
            </div>
            <div className="account-hero-card">
              <div className="account-avatar-panel">
                <div className="account-avatar-shell" aria-label="头像预览">
                  <div className="account-avatar-media" style={{ backgroundImage: `url(${accountProfile.avatarUrl || DEFAULT_AVATAR_URL})` }}>
                    {!accountProfile.avatarUrl || accountProfile.avatarUrl === DEFAULT_AVATAR_URL ? <strong>{accountProfile.nickname ? accountProfile.nickname.slice(0, 1).toUpperCase() : 'J'}</strong> : null}
                  </div>
                </div>
                <div className="account-hero-copy">
                  <div className="account-name-row">
                    <h1>{accountProfile.nickname || '未设置昵称'}</h1>
                  </div>
                  <p>手机号：{accountProfile.phone || '未绑定'}</p>
                </div>
              </div>
              <div className="account-status-line">{accountProfileLoaded ? accountProfile.message : '正在加载云端资料…'}</div>
            </div>
            <section className="account-archive-card">
              <div className="panel-head"><div><p className="panel-kicker">账户资料</p><h2>编辑并保存到云数据库</h2></div></div>
              <div className="account-form-grid">
                <label className="account-form-field">
                  <span>昵称</span>
                  <input value={accountProfile.nickname} onChange={(event) => handleAccountProfileChange('nickname', event.target.value)} placeholder="请输入昵称" />
                </label>
                <label className="account-form-field">
                  <span>手机号</span>
                  <input value={accountProfile.phone || accountUserId} readOnly placeholder="手机号不可修改" />
                </label>
                <label className="account-form-field account-form-field-full">
                  <span>头像图片</span>
                        <input type="file" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleAccountAvatarUpload(file)
                        }} />               
                </label>
                <label className="account-form-field account-form-field-full">
                  <span>密码</span>
                  <div className="account-password-row">
                    <input type={accountProfile.editingPassword ? 'text' : 'password'} value={accountProfile.password} onChange={(event) => handleAccountProfileChange('password', event.target.value)} placeholder="请输入新密码" />
                    <button type="button" className="account-edit-btn" onClick={handleAccountPasswordToggle}>{accountProfile.editingPassword ? '隐藏' : '显示'}</button>
                  </div>
                </label>
              </div>
              <div className="account-form-actions">
                <button type="button" className="profile-primary-button" onClick={handleAccountSave} disabled={accountProfile.saving || accountProfile.loading || !accountProfileLoaded}>{accountProfile.saving ? '保存中…' : accountProfile.loading ? '加载中…' : '保存修改'}</button>
              </div>
            </section>
            <section className="account-tabs-card">
              <div className="account-tabs">
                <button className={accountTab === 'posts' ? 'account-tab active' : 'account-tab'} onClick={() => setAccountTab('posts')}>我的帖子 ({accountTabContent.posts.count})</button>
                <button className={accountTab === 'answers' ? 'account-tab active' : 'account-tab'} onClick={() => setAccountTab('answers')}>我的回答 ({accountTabContent.answers.count})</button>
                <button className={accountTab === 'favorites' ? 'account-tab active' : 'account-tab'} onClick={() => setAccountTab('favorites')}>我的收藏 ({accountTabContent.favorites.count})</button>
              </div>
              <div className="account-tab-panel">
                {accountTab === 'posts' ? (
                  <div className="account-record-list">
                    {myPosts.length ? myPosts.map((post) => (
                      <div key={post.id} className="account-record-item">
                        <strong>{post.title}</strong>
                        <p>{post.content}</p>
                        <span>{post.tag} · {post.createdAt}</span>
                      </div>
                    )) : <p>{accountTabData.emptyText}</p>}
                  </div>
                ) : null}
                {accountTab === 'answers' ? (
                  <div className="account-record-list">
                    {myAnswers.length ? myAnswers.map((reply) => (
                      <div key={reply.id} className="account-record-item">
                        <strong>{reply.content}</strong>
                        <p>对应问题：{communityPosts.find((post) => post.id === reply.postId)?.title || reply.postId}</p>
                        <span>{reply.authorRole} · {reply.createdAt}</span>
                      </div>
                    )) : <p>{accountTabData.emptyText}</p>}
                  </div>
                ) : null}
                {accountTab === 'favorites' ? (
                  <div className="account-record-list">
                    {favoriteCourses.length ? favoriteCourses.map((item) => (
                      <button key={item.id} type="button" className="account-record-item clickable" onClick={() => handleFavoriteItemClick(item.courseId)}>
                        <strong>{item.courseTitle}</strong>
                        <p>{item.courseDesc}</p>
                        <span>{item.courseCategory} · {item.courseDuration}</span>
                      </button>
                    )) : <p>{accountTabData.emptyText}</p>}
                    {favoriteLoading ? <p>正在加载收藏…</p> : null}
                  </div>
                ) : null}
              </div>
            </section>
          </section>
        ) : activeSection === 'ai' ? (
          <section className="ai-page">
            <div className="ai-hero-card">
              <div>
                <p className="panel-kicker">AI 助手</p>
                <h1>24 小时智能答疑</h1>
                <p>随时提问，获取家长教育、沟通技巧与微课推荐建议。</p>
              </div>
            </div>
            <div className="ai-chat-card">
              <div className="ai-chat-list" ref={aiChatListRef}>
                {aiMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={message.role === 'assistant' ? 'ai-message assistant' : 'ai-message user'}>
                    {message.text}
                  </div>
                ))}
                {aiLoading ? <div className="ai-message assistant">正在思考中…</div> : null}
              </div>
              {aiError ? <div className="ai-error-tip">{aiError}</div> : null}
              <div className="ai-input-row">
                <div className="ai-input-shell">
                  <textarea value={aiInput} onChange={(event) => setAiInput(event.target.value)} onKeyDown={handleAiKeyDown} placeholder="请输入你的问题，例如：如何跟孩子沟通作业问题？" />
                  <div className="ai-input-hint">按回车直接发送，Shift + Enter 换行</div>
                </div>
                <button className="recommend-button ai-send-button" onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()}>{aiLoading ? '发送中…' : '发送'}</button>
              </div>
            </div>
          </section>
        ) : activeSection === 'home' ? (
          <section className="home-panel">
            <div className="home-hero">
              <p className="panel-kicker">县域家庭教育支持平台</p>
              <h1>守护县域孩子成长，陪伴家长轻松学习</h1>
              <p>这里是面向脱贫县域中小学生家长的教育服务首页，帮助您更方便地找到课程、社区支持和个性化成长建议。</p>
            </div>

            <section className="home-carousel-card">
              <div className="home-carousel-head"><div></div></div>
              <div className="home-carousel">
                <button className="carousel-arrow prev" onClick={() => setActiveBannerIndex((i) => (i - 1 + 3) % 3)} aria-label="上一张轮播图">‹</button>
                <button className="carousel-arrow next" onClick={() => setActiveBannerIndex((i) => (i + 1) % 3)} aria-label="下一张轮播图">›</button>
                <div
                  className="carousel-image"
                  style={{ backgroundImage: `url(${VIDEO_BACKGROUNDS[activeBannerIndex]})` }}
                  onClick={() => {
                    const target = carouselTargets[activeBannerIndex]
                    if (target === 'ai') {
                      setActiveSection('ai')
                    } else if (target) {
                      openCoursePage(target)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    const target = carouselTargets[activeBannerIndex]
                    if (target === 'ai') {
                      setActiveSection('ai')
                    } else if (target) {
                      openCoursePage(target)
                    }
                  }}
                >
                  <div className="carousel-overlay" />
                  <div className="carousel-copy">
                    <h3>{['不辅导作业，也能当好家长','如何与老师聊出效果','家长教育AI助手'][activeBannerIndex]}</h3>
                    <p>{['从家长“叮作业”转向“会支持”','掌握与老师高效沟通的聊天方式','智能辅助，科学育儿'][activeBannerIndex]}</p>
                  </div>
                </div>
                <div className="carousel-dots" aria-hidden="true">{[0, 1, 2].map((index) => (<button key={index} className={index === activeBannerIndex ? 'carousel-dot active' : 'carousel-dot'} onClick={() => setActiveBannerIndex(index)} />))}</div>
              </div>
            </section>

            <section className="home-quick-grid" aria-label="快捷入口">{quickModules.map((module) => (<button key={module.key} className="home-quick-card" onClick={() => setActiveSection(module.key)}><div className={`home-quick-icon ${module.key}`} aria-hidden="true">{module.key === 'profile' ? '◎' : module.key === 'courses' ? '▣' : module.key === 'community' ? '◉' : '◆'}</div><strong>{module.title}</strong><span>{module.hint}</span></button>))}</section>

            <section className="home-recommend-card">
              <div className="panel-head"><div><p className="panel-kicker">今日推荐</p><h2>今日推荐卡片</h2></div><span className="panel-badge">推荐给家长</span></div>
              <div className="home-recommend-list-grid">{featuredCourses.map((course) => (<button key={course.id} className="home-recommend-item-card" onClick={() => openCoursePage(course)}><div className="home-recommend-thumb home-recommend-thumb-small" aria-hidden="true">▶</div><div className="home-recommend-item-content"><h3>{course.title}</h3><p>{course.shortDesc}</p><div className="course-meta"><span className="meta-tag">#{course.category}</span><span className="meta-time">{course.duration}</span></div><div className="course-progress-line"><div className="course-progress-fill" style={{ width: `${course.progress}%` }} /></div><small>进度 {course.progress}%</small></div></button>))}</div>
            </section>

            <section className="home-progress-card">
              <div className="panel-head"><div><p className="panel-kicker">学习进度</p><h2>今日学习时长</h2></div><span className="time-text">{todayStudyMinutes} 分钟</span></div>
              <div className="progress-track" aria-label="学习进度条"><div className="progress-fill" style={{ width: `${Math.min(100, Math.round((todayStudyMinutes / 30) * 100))}%` }} /></div>
              <p className="progress-tip">今日目标：学习 30 分钟</p>
              <div className="progress-stats"><div><strong>{todayStudyMinutes}</strong><span>今日学习时长</span></div><div><strong>{learnedCourseCount}</strong><span>已学课程</span></div><div><strong>{accumulatedPoints}</strong><span>累计积分</span></div><div><strong>{postedCount}</strong><span>发布帖子</span></div></div>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
