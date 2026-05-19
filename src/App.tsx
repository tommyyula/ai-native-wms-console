import {
  AlertCircle,
  Bell,
  Bot,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Database,
  Download,
  Edit3,
  FileInput,
  Filter,
  Gauge,
  Globe2,
  HelpCircle,
  LayoutList,
  LockKeyhole,
  LogOut,
  PackageCheck,
  PackagePlus,
  PanelRightOpen,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  User,
  Warehouse,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  inboundBuckets,
  inventorySeed,
  outboundBuckets,
  outboundSeed,
  type DayBucket,
  type InventoryItem,
  type InventoryStatus,
  type Language,
  type MovementOrder,
  type MovementStatus,
  type Tenant,
} from './data/seed'
import { languages, translate } from './i18n'
import {
  exportCsv,
  getApiMode,
  getRuntimeConfig,
  IAM_SESSION_SCHEMA_VERSION,
  listInbound,
  listInventory,
  listOutbound,
  loginWithIam,
  syncRecord,
  type AuthSession,
  type RuntimeContext,
} from './services/api'
import './App.css'

type Page = 'inventory' | 'inbound' | 'outbound'
type DrawerTarget = { kind: 'inventory'; item: InventoryItem } | { kind: 'movement'; item: MovementOrder } | null
type Toast = { message: string; tone: 'success' | 'info' | 'warning' }

const defaultEmail = 'operator@item.com'

const movementStatus: MovementStatus[] = ['draft', 'planned', 'ordered', 'processing', 'completed', 'exception']
const inventoryStatuses: InventoryStatus[] = ['available', 'allocated', 'hold', 'short', 'inspection']

const preferredTenantId = (tenantList: Tenant[]) => tenantList.find((tenant) => tenant.id === 'tenant-plus')?.id || tenantList[0]?.id || ''

const movementStatusText: Record<MovementStatus, Record<Language, string>> = {
  draft: { zh: '草稿', en: 'Draft', ja: '下書き' },
  planned: { zh: '予定', en: 'Planned', ja: '予定' },
  ordered: { zh: '已发注', en: 'Ordered', ja: '発注済み' },
  processing: { zh: '处理中', en: 'Processing', ja: '処理中' },
  completed: { zh: '已完成', en: 'Completed', ja: '完了' },
  exception: { zh: '异常', en: 'Exception', ja: '例外' },
}

const inventoryStatusText: Record<InventoryStatus, Record<Language, string>> = {
  available: { zh: '可用', en: 'Available', ja: '利用可能' },
  allocated: { zh: '已分配', en: 'Allocated', ja: '引当済' },
  hold: { zh: '保留', en: 'Hold', ja: '保留' },
  short: { zh: '短缺', en: 'Short', ja: '不足' },
  inspection: { zh: '检验中', en: 'Inspection', ja: '検品中' },
}

const riskText: Record<InventoryItem['risk'], Record<Language, string>> = {
  low: { zh: '低', en: 'Low', ja: '低' },
  medium: { zh: '中', en: 'Medium', ja: '中' },
  high: { zh: '高', en: 'High', ja: '高' },
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value))

const uniq = (values: string[]) => Array.from(new Set(values)).filter(Boolean)

const formatNumber = (value: number) => new Intl.NumberFormat().format(value)

function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('wms_language') as Language) || 'zh')
  const [session, setSession] = useState<AuthSession | null>(() => {
    const saved = readJson<AuthSession | null>('wms_session', null)
    return saved?.schemaVersion === IAM_SESSION_SCHEMA_VERSION ? saved : null
  })
  const [context, setContext] = useState<RuntimeContext | null>(() => {
    const savedSession = readJson<AuthSession | null>('wms_session', null)
    return savedSession?.schemaVersion === IAM_SESSION_SCHEMA_VERSION ? readJson<RuntimeContext | null>('wms_context', null) : null
  })
  const [activePage, setActivePage] = useState<Page>('inventory')
  const [inventory, setInventory] = useState<InventoryItem[]>(inventorySeed)
  const [inbound, setInbound] = useState<MovementOrder[]>([])
  const [outbound, setOutbound] = useState<MovementOrder[]>(outboundSeed)
  const [drawer, setDrawer] = useState<DrawerTarget>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [noticeVisible, setNoticeVisible] = useState(true)
  const [apiNonce, setApiNonce] = useState(0)

  const t = (key: string) => translate(language, key)
  const apiMode = getApiMode()
  const selectedTenant = session?.tenants.find((tenant) => tenant.id === context?.tenantId)
  const selectedWarehouse = selectedTenant?.warehouses.find((warehouse) => warehouse.id === context?.warehouseId)

  useEffect(() => {
    localStorage.setItem('wms_language', language)
  }, [language])

  useEffect(() => {
    if (!session || !context) return
    let cancelled = false
    Promise.all([listInventory(session, context), listInbound(session, context), listOutbound(session, context)])
      .then(([inventoryRows, inboundRows, outboundRows]) => {
        if (cancelled) return
        setInventory(inventoryRows)
        setInbound(inboundRows)
        setOutbound(outboundRows)
      })
      .catch((error) => {
        showToast(error.message || 'API error', 'warning')
      })
    return () => {
      cancelled = true
    }
  }, [session, context, apiNonce])

  function showToast(message: string, tone: Toast['tone'] = 'info') {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 2800)
  }

  async function handleLogin(nextSession: AuthSession) {
    setSession(nextSession)
    writeJson('wms_session', nextSession)
    if (nextSession.tenants.length === 1 && nextSession.tenants[0].warehouses.length === 1) {
      const nextContext = {
        tenantId: nextSession.tenants[0].id,
        warehouseId: nextSession.tenants[0].warehouses[0].id,
        locale: language,
      }
      setContext(nextContext)
      writeJson('wms_context', nextContext)
    }
  }

  function handleContextChange(nextContext: RuntimeContext) {
    setContext(nextContext)
    writeJson('wms_context', nextContext)
    showToast(`${t('warehouse')}: ${nextContext.warehouseId}`, 'success')
  }

  function signOut() {
    localStorage.removeItem('wms_session')
    localStorage.removeItem('wms_context')
    setSession(null)
    setContext(null)
  }

  if (!session) {
    return <LoginScreen language={language} setLanguage={setLanguage} onLogin={handleLogin} />
  }

  if (!context) {
    return (
      <ContextGate
        language={language}
        session={session}
        setLanguage={setLanguage}
        onContinue={handleContextChange}
        onSignOut={signOut}
      />
    )
  }

  return (
    <div className="app-shell">
      <TopHeader
        apiMode={apiMode}
        context={context}
        language={language}
        selectedTenant={selectedTenant}
        selectedWarehouse={selectedWarehouse}
        session={session}
        setLanguage={setLanguage}
        setContext={handleContextChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={signOut}
        t={t}
      />
      {noticeVisible && <NoticeBar onHide={() => setNoticeVisible(false)} t={t} />}
      <MainNav activePage={activePage} setActivePage={setActivePage} onSettings={() => setSettingsOpen(true)} onHelp={() => setHelpOpen(true)} t={t} />
      <div className="workspace">
        <Sidebar activePage={activePage} setActivePage={setActivePage} onHelp={() => setHelpOpen(true)} />
        <main className="content">
          {activePage === 'inventory' && (
            <InventoryPage
              rows={inventory}
              language={language}
              onRowsChange={setInventory}
              onOpenDetails={(item) => setDrawer({ kind: 'inventory', item })}
              onToast={showToast}
              t={t}
            />
          )}
          {activePage === 'inbound' && (
            <MovementPage
              direction="inbound"
              rows={inbound}
              buckets={inboundBuckets}
              language={language}
              onRowsChange={setInbound}
              onOpenDetails={(item) => setDrawer({ kind: 'movement', item })}
              onToast={showToast}
              t={t}
            />
          )}
          {activePage === 'outbound' && (
            <MovementPage
              direction="outbound"
              rows={outbound}
              buckets={outboundBuckets}
              language={language}
              onRowsChange={setOutbound}
              onOpenDetails={(item) => setDrawer({ kind: 'movement', item })}
              onToast={showToast}
              t={t}
            />
          )}
        </main>
      </div>
      <BusinessDrawer
        drawer={drawer}
        language={language}
        session={session}
        context={context}
        onClose={() => setDrawer(null)}
        onToast={showToast}
        t={t}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setApiNonce((value) => value + 1)
          showToast(t('saved'), 'success')
        }}
        t={t}
      />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} t={t} apiMode={apiMode} />
      {toast && <ToastView toast={toast} />}
    </div>
  )
}

function LoginScreen({
  language,
  setLanguage,
  onLogin,
}: {
  language: Language
  setLanguage: (language: Language) => void
  onLogin: (session: AuthSession) => void
}) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('demo-password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = (key: string) => translate(language, key)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const session = await loginWithIam({ email, password, locale: language })
      onLogin(session)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-brand">
        <Logo />
        <LanguageSelect language={language} setLanguage={setLanguage} />
      </div>
      <section className="login-panel">
        <div className="login-copy">
          <div className="security-mark">
            <ShieldCheck size={28} />
          </div>
          <h1>{t('loginTitle')}</h1>
          <p>{t('loginSubtitle')}</p>
          <div className="login-contract">
            <LockKeyhole size={18} />
            <span>Ontology: WMS-3.0 `a007b` + IAM `a0078`</span>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            {t('email')}
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            {t('password')}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            <LockKeyhole size={17} />
            {loading ? '...' : t('signIn')}
          </button>
          <p className="form-note">{t('demoHint')}</p>
        </form>
      </section>
    </div>
  )
}

function ContextGate({
  language,
  session,
  setLanguage,
  onContinue,
  onSignOut,
}: {
  language: Language
  session: AuthSession
  setLanguage: (language: Language) => void
  onContinue: (context: RuntimeContext) => void
  onSignOut: () => void
}) {
  const [tenantId, setTenantId] = useState(preferredTenantId(session.tenants))
  const selectedTenant = session.tenants.find((tenant) => tenant.id === tenantId) || session.tenants[0]
  const [warehouseId, setWarehouseId] = useState(selectedTenant?.warehouses[0]?.id || '')
  const t = (key: string) => translate(language, key)

  return (
    <div className="context-screen">
      <div className="login-brand">
        <Logo />
        <div className="context-actions">
          <LanguageSelect language={language} setLanguage={setLanguage} />
          <button className="ghost-button" type="button" onClick={onSignOut}>
            <LogOut size={16} />
            {t('signOut')}
          </button>
        </div>
      </div>
      <section className="context-panel">
        <div>
          <p className="eyeless-label">IAM: {session.user.email} · {session.source}</p>
          <h1>{t('selectContext')}</h1>
          <p>{t('selectContextSubtitle')}</p>
        </div>
        <div className="context-grid">
          <label>
            {t('tenant')}
            <select
              value={tenantId}
              onChange={(event) => {
                const nextTenant = session.tenants.find((tenant) => tenant.id === event.target.value)
                setTenantId(event.target.value)
                setWarehouseId(nextTenant?.warehouses[0]?.id || '')
              }}
            >
              {session.tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('warehouse')}
            <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {selectedTenant?.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="warehouse-preview">
          {selectedTenant?.warehouses
            .filter((warehouse) => warehouse.id === warehouseId)
            .map((warehouse) => (
              <div key={warehouse.id}>
                <Warehouse size={26} />
                <strong>{warehouse.name}</strong>
                <span>{warehouse.region}</span>
                <span>{warehouse.capabilities.join(' / ')}</span>
              </div>
            ))}
        </div>
        <section className="iam-directory">
          <header>
            <strong>{t('iamDirectory')}</strong>
            <span>{session.tenants.length} {t('tenant')} / {session.tenants.reduce((sum, tenant) => sum + tenant.warehouses.length, 0)} {t('warehouse')}</span>
          </header>
          <div>
            {session.tenants.map((tenant) => (
              <article key={tenant.id}>
                <strong>{tenant.name}</strong>
                <span>{tenant.code}</span>
                <p>{tenant.warehouses.map((warehouse) => warehouse.code).join(', ')}</p>
              </article>
            ))}
          </div>
        </section>
        <button className="primary-button" type="button" onClick={() => onContinue({ tenantId, warehouseId, locale: language })}>
          <Gauge size={17} />
          {t('continue')}
        </button>
      </section>
    </div>
  )
}

function TopHeader({
  apiMode,
  context,
  language,
  selectedTenant,
  selectedWarehouse,
  session,
  setLanguage,
  setContext,
  onOpenSettings,
  onSignOut,
  t,
}: {
  apiMode: 'production' | 'demo'
  context: RuntimeContext
  language: Language
  selectedTenant?: Tenant
  selectedWarehouse?: Tenant['warehouses'][number]
  session: AuthSession
  setLanguage: (language: Language) => void
  setContext: (context: RuntimeContext) => void
  onOpenSettings: () => void
  onSignOut: () => void
  t: (key: string) => string
}) {
  return (
    <header className="top-header">
      <Logo />
      <div className="top-spacer" />
      <button className="top-link" type="button">
        <Bell size={18} />
        {t('announcements')}
        <span className="dot" />
      </button>
      <label className="tenant-select">
        <Building2 size={17} />
        <select
          value={context.tenantId}
          onChange={(event) => {
            const tenant = session.tenants.find((candidate) => candidate.id === event.target.value)
            setContext({ ...context, tenantId: event.target.value, warehouseId: tenant?.warehouses[0]?.id || context.warehouseId })
          }}
        >
          {session.tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </label>
      <label className="tenant-select">
        <Warehouse size={17} />
        <select value={context.warehouseId} onChange={(event) => setContext({ ...context, warehouseId: event.target.value })}>
          {selectedTenant?.warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code}
            </option>
          ))}
        </select>
      </label>
      <LanguageSelect language={language} setLanguage={setLanguage} compact />
      <button className={`api-pill ${apiMode}`} type="button" onClick={onOpenSettings}>
        {apiMode === 'production' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
        {t('apiMode')}: {t(apiMode)}
      </button>
      <div className="user-menu">
        <User size={17} />
        <span>{session.user.role}</span>
        <ChevronDown size={15} />
        <button type="button" onClick={onSignOut} aria-label={t('signOut')}>
          <LogOut size={15} />
        </button>
      </div>
      <span className="sr-only">{selectedWarehouse?.name}</span>
    </header>
  )
}

function NoticeBar({ onHide, t }: { onHide: () => void; t: (key: string) => string }) {
  return (
    <div className="notice-bar">
      <strong>{t('notice')}</strong>
      <button type="button">
        {t('more')}
        <PanelRightOpen size={15} />
      </button>
      <button type="button" onClick={onHide}>
        {t('hideMessage')}
      </button>
    </div>
  )
}

function MainNav({
  activePage,
  setActivePage,
  onSettings,
  onHelp,
  t,
}: {
  activePage: Page
  setActivePage: (page: Page) => void
  onSettings: () => void
  onHelp: () => void
  t: (key: string) => string
}) {
  return (
    <nav className="main-nav">
      <button className="active" type="button">
        <Plus size={18} />
        {t('newInventoryData')}
      </button>
      <button className={activePage === 'inventory' ? 'selected' : ''} type="button" onClick={() => setActivePage('inventory')}>
        <LayoutList size={18} />
        {t('inventoryInfo')}
      </button>
      <button className={activePage !== 'inventory' ? 'selected' : ''} type="button" onClick={() => setActivePage(activePage === 'outbound' ? 'outbound' : 'inbound')}>
        <Truck size={18} />
        {t('inout')}
      </button>
      <button type="button">
        <ClipboardList size={18} />
        {t('tools')}
      </button>
      <span className="nav-spacer" />
      <button type="button">
        <Database size={18} />
        {t('dataManagement')}
      </button>
      <button type="button" onClick={onSettings}>
        <Settings size={18} />
        {t('settings')}
      </button>
      <button type="button" onClick={onHelp}>
        <HelpCircle size={18} />
        {t('help')}
      </button>
    </nav>
  )
}

function Sidebar({ activePage, setActivePage, onHelp }: { activePage: Page; setActivePage: (page: Page) => void; onHelp: () => void }) {
  return (
    <aside className="side-rail">
      <button className={activePage === 'inventory' ? 'active' : ''} type="button" onClick={() => setActivePage('inventory')} title="Inventory">
        <Boxes size={21} />
      </button>
      <button className={activePage === 'inbound' ? 'active' : ''} type="button" onClick={() => setActivePage('inbound')} title="Inbound">
        <PackagePlus size={21} />
      </button>
      <button className={activePage === 'outbound' ? 'active' : ''} type="button" onClick={() => setActivePage('outbound')} title="Outbound">
        <PackageCheck size={21} />
      </button>
      <button type="button" title="Automation">
        <Bot size={21} />
      </button>
      <button type="button" title="Help" onClick={onHelp}>
        <CircleHelp size={21} />
      </button>
    </aside>
  )
}

function InventoryPage({
  rows,
  language,
  onRowsChange,
  onOpenDetails,
  onToast,
  t,
}: {
  rows: InventoryItem[]
  language: Language
  onRowsChange: (rows: InventoryItem[]) => void
  onOpenDetails: (item: InventoryItem) => void
  onToast: (message: string, tone?: Toast['tone']) => void
  t: (key: string) => string
}) {
  const [query, setQuery] = useState('t-Sort')
  const [category, setCategory] = useState('')
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const haystack = `${row.title} ${row.sku} ${row.id} ${row.owner} ${row.category}`.toLowerCase()
        return (
          (!query || haystack.includes(query.toLowerCase())) &&
          (!category || row.category === category) &&
          (!owner || row.owner === owner) &&
          (!status || row.status === status)
        )
      }),
    [rows, query, category, owner, status],
  )

  const categories = uniq(rows.map((row) => row.category))
  const owners = uniq(rows.map((row) => row.owner))
  const allSelected = filtered.length > 0 && filtered.every((row) => selected.includes(row.id))

  function toggleSelection(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function updateStatus(ids: string[], nextStatus: InventoryStatus) {
    onRowsChange(rows.map((row) => (ids.includes(row.id) ? { ...row, status: nextStatus, lastUpdated: '2026-05-19 15:21' } : row)))
    setSelected([])
    onToast(t('saved'), 'success')
  }

  return (
    <section className="page">
      <PageTitle
        title={t('inventoryTitle')}
        count={filtered.length}
        t={t}
        actions={
          <>
            <button className="orange-button" type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={17} />
              {t('newRegistration')}
            </button>
            <button className="teal-button" type="button" onClick={() => onToast(t('directEdit'), 'info')}>
              <Edit3 size={17} />
              {t('directEdit')}
            </button>
            <button className="soft-button" type="button" onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              {t('import')}
            </button>
            <button
              className="soft-button"
              type="button"
              onClick={() => {
                exportCsv(
                  'inventory.csv',
                  filtered.map((row) => ({
                    id: row.id,
                    sku: row.sku,
                    title: row.title,
                    owner: row.owner,
                    onHand: row.onHand,
                    available: row.available,
                    status: row.status,
                  })),
                )
                onToast(t('export'), 'success')
              }}
            >
              <Download size={17} />
              {t('export')}
            </button>
          </>
        }
      />

      <div className="search-chip-row">
        <span>{t('detailedSearch')}</span>
        <em>{t('itemName')}: {query || '-'}</em>
        <em>{t('category')}: {category || '-'}</em>
        <button type="button" onClick={() => setQuery('')}>
          <X size={15} />
        </button>
      </div>

      <div className="filter-panel compact">
        <label>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPlaceholder')} />
        </label>
        <label>
          {t('category')}
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          {t('owner')}
          <select value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="">All</option>
            {owners.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          {t('status')}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {inventoryStatuses.map((value) => (
              <option key={value} value={value}>
                {inventoryStatusText[value][language]}
              </option>
            ))}
          </select>
        </label>
        <button className="text-button" type="button" onClick={() => { setQuery(''); setCategory(''); setOwner(''); setStatus('') }}>
          {t('reset')}
        </button>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} {t('selected')}</strong>
          <button type="button" onClick={() => updateStatus(selected, 'hold')}>{t('bulkHold')}</button>
          <button type="button" onClick={() => updateStatus(selected, 'available')}>{t('bulkRelease')}</button>
          <button type="button" onClick={() => onToast(t('syncNow'), 'info')}>{t('syncNow')}</button>
        </div>
      )}

      <OperationBoard
        title={t('quickOps')}
        actions={[
          { label: t('cycleCount'), icon: <ClipboardList size={18} /> },
          { label: t('stockAdjust'), icon: <Edit3 size={18} /> },
          { label: t('transfer'), icon: <Truck size={18} /> },
          { label: t('replenishment'), icon: <Sparkles size={18} /> },
          { label: t('freezeStock'), icon: <ShieldCheck size={18} /> },
          { label: t('apiSync'), icon: <RefreshCcw size={18} /> },
        ]}
        onAction={(label) => onToast(`${label}: ${t('actionQueued')}`, 'success')}
      />

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : filtered.map((row) => row.id))}
                />
              </th>
              <th>{t('itemName')}</th>
              <th>{t('inventoryId')}</th>
              <th>{t('managementCode')}</th>
              <th>{t('owner')}</th>
              <th>{t('onHand')}</th>
              <th>{t('available')}</th>
              <th>{t('location')}</th>
              <th>{t('maker')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} onDoubleClick={() => onOpenDetails(row)}>
                <td>
                  <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelection(row.id)} />
                </td>
                <td>
                  <button className="row-title" type="button" onClick={() => onOpenDetails(row)}>
                    <span>{row.subcategory}</span>
                    {row.title}
                  </button>
                </td>
                <td>{row.id}</td>
                <td>{row.sku}</td>
                <td>{row.owner}</td>
                <td className="numeric">{formatNumber(row.onHand)}</td>
                <td className="numeric">{formatNumber(row.available)}</td>
                <td>{row.zone} / {row.location}</td>
                <td>{row.maker}</td>
                <td>
                  <select className={`status-select ${row.status}`} value={row.status} onChange={(event) => updateStatus([row.id], event.target.value as InventoryStatus)}>
                    {inventoryStatuses.map((value) => (
                      <option key={value} value={value}>
                        {inventoryStatusText[value][language]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <Pagination />
        <div className="footer-actions">
          <button type="button" onClick={() => setViewOpen(true)}>
            <Settings size={17} />
            {t('viewSettings')}
          </button>
          <button type="button">
            <SlidersHorizontal size={17} />
            {t('sortNewest')}
          </button>
        </div>
      </div>

      <InventoryCreateDialog
        open={createOpen}
        language={language}
        onClose={() => setCreateOpen(false)}
        onCreate={(item) => {
          onRowsChange([item, ...rows])
          setCreateOpen(false)
          onToast(t('saved'), 'success')
        }}
        t={t}
      />
      <SimpleDialog open={importOpen} title={t('import')} onClose={() => setImportOpen(false)} t={t}>
        <div className="drop-zone">
          <FileInput size={28} />
          <p>CSV / XLSX / ASN</p>
          <input
            type="file"
            onChange={() => {
              setImportOpen(false)
              onToast(t('import'), 'success')
            }}
          />
        </div>
      </SimpleDialog>
      <SimpleDialog open={viewOpen} title={t('viewSettings')} onClose={() => setViewOpen(false)} t={t}>
        <div className="settings-list">
          <label><input type="checkbox" defaultChecked /> {t('assetNo')}</label>
          <label><input type="checkbox" defaultChecked /> {t('lastUpdated')}</label>
          <label><input type="checkbox" defaultChecked /> {t('risk')}</label>
          <button className="primary-button" type="button" onClick={() => { setViewOpen(false); onToast(t('saved'), 'success') }}>
            <Save size={16} />
            {t('save')}
          </button>
        </div>
      </SimpleDialog>
    </section>
  )
}

function MovementPage({
  direction,
  rows,
  buckets,
  language,
  onRowsChange,
  onOpenDetails,
  onToast,
  t,
}: {
  direction: 'inbound' | 'outbound'
  rows: MovementOrder[]
  buckets: DayBucket[]
  language: Language
  onRowsChange: (rows: MovementOrder[]) => void
  onOpenDetails: (item: MovementOrder) => void
  onToast: (message: string, tone?: Toast['tone']) => void
  t: (key: string) => string
}) {
  const [query, setQuery] = useState('')
  const [partner, setPartner] = useState('')
  const [registeredBy, setRegisteredBy] = useState('')
  const [status, setStatus] = useState('')
  const [activeDate, setActiveDate] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const title = direction === 'inbound' ? t('inboundTitle') : t('outboundTitle')
  const dateLabel = direction === 'inbound' ? t('inboundDate') : t('outboundDate')
  const expectedLabel = direction === 'inbound' ? t('expectedInbound') : t('expectedOutbound')
  const overdueLabel = direction === 'inbound' ? t('overdueInbound') : t('overdueOutbound')

  const filtered = rows.filter((row) => {
    const haystack = `${row.no} ${row.partner} ${row.itemSummary} ${row.registeredBy}`.toLowerCase()
    return (
      (!query || haystack.includes(query.toLowerCase())) &&
      (!partner || row.partner === partner) &&
      (!registeredBy || row.registeredBy.toLowerCase().includes(registeredBy.toLowerCase())) &&
      (!status || row.status === status) &&
      (!activeDate || row.expectedDate === activeDate || row.actualDate === activeDate)
    )
  })
  const partners = uniq(rows.map((row) => row.partner))
  const allSelected = filtered.length > 0 && filtered.every((row) => selected.includes(row.id))

  function updateStatus(id: string, nextStatus: MovementStatus) {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)))
    onToast(t('saved'), 'success')
  }

  function removeRow(id: string) {
    onRowsChange(rows.filter((row) => row.id !== id))
    onToast(t('saved'), 'success')
  }

  return (
    <section className="page">
      <PageTitle
        title={title}
        count={filtered.length}
        t={t}
        actions={
          <>
            {direction === 'inbound' && (
              <button className="orange-button" type="button" onClick={() => setAiOpen(true)}>
                <Bot size={17} />
                {t('aiInbound')}
              </button>
            )}
            <button className="teal-button" type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={17} />
              {t('newRegistration')}
            </button>
            <button className="soft-button" type="button" onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              {t('import')}
            </button>
            <button
              className="soft-button"
              type="button"
              onClick={() => {
                exportCsv(
                  `${direction}.csv`,
                  filtered.map((row) => ({
                    no: row.no,
                    partner: row.partner,
                    items: row.itemSummary,
                    status: row.status,
                    expectedDate: row.expectedDate,
                    actualDate: row.actualDate,
                  })),
                )
                onToast(t('export'), 'success')
              }}
            >
              <Download size={17} />
              {t('export')}
            </button>
          </>
        }
      />

      <div className="filter-panel movement">
        <label>
          {t('no')}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="No / item / partner" />
        </label>
        <label>
          {t('partner')}
          <select value={partner} onChange={(event) => setPartner(event.target.value)}>
            <option value="">All</option>
            {partners.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          {t('includedItems')}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('includedItems')} />
        </label>
        <label>
          {t('registeredBy')}
          <input value={registeredBy} onChange={(event) => setRegisteredBy(event.target.value)} placeholder={t('registeredBy')} />
        </label>
        <label>
          {dateLabel}
          <input type="date" onChange={(event) => setActiveDate(event.target.value)} />
        </label>
        <label>
          {expectedLabel}
          <input type="date" onChange={(event) => setActiveDate(event.target.value)} />
        </label>
        <label>
          {t('status')}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {movementStatus.map((value) => (
              <option key={value} value={value}>
                {movementStatusText[value][language]}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" onChange={(event) => event.currentTarget.checked ? setStatus('exception') : setStatus('')} />
          {overdueLabel}
        </label>
        <button className="text-button reset" type="button" onClick={() => { setQuery(''); setPartner(''); setRegisteredBy(''); setStatus(''); setActiveDate('') }}>
          {t('reset')}
        </button>
      </div>

      <DateStrip buckets={buckets} activeDate={activeDate} setActiveDate={setActiveDate} t={t} />

      <OperationBoard
        title={t('quickOps')}
        actions={
          direction === 'inbound'
            ? [
                { label: t('asnImport'), icon: <Upload size={18} /> },
                { label: t('dockSchedule'), icon: <Calendar size={18} /> },
                { label: t('receiveScan'), icon: <PackagePlus size={18} /> },
                { label: t('qcInspection'), icon: <ShieldCheck size={18} /> },
                { label: t('putaway'), icon: <Warehouse size={18} /> },
                { label: t('inboundException'), icon: <AlertCircle size={18} /> },
              ]
            : [
                { label: t('wavePlan'), icon: <SlidersHorizontal size={18} /> },
                { label: t('allocation'), icon: <Boxes size={18} /> },
                { label: t('pickTask'), icon: <ClipboardList size={18} /> },
                { label: t('packTask'), icon: <PackageCheck size={18} /> },
                { label: t('shipConfirm'), icon: <Truck size={18} /> },
                { label: t('labelPrint'), icon: <Download size={18} /> },
              ]
        }
        onAction={(label) => onToast(`${label}: ${t('actionQueued')}`, 'success')}
      />

      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} {t('selected')}</strong>
          <button type="button" onClick={() => onToast(t('bulkWave'), 'success')}>{t('bulkWave')}</button>
          <button type="button" onClick={() => setSelected([])}>{t('cancel')}</button>
        </div>
      )}

      <div className="table-toolbar">
        <button type="button">
          <Settings size={17} />
          {t('viewSettings')}
        </button>
        <button type="button">
          <Filter size={17} />
          {t('userGroup')}
        </button>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : filtered.map((row) => row.id))}
                />
              </th>
              <th>{t('status')}</th>
              <th>{t('no')}</th>
              <th>{t('partner')}</th>
              <th>{t('includedItems')}</th>
              <th>{t('total')}</th>
              <th>{t('memo')}</th>
              <th>{expectedLabel}</th>
              <th>{dateLabel}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} onDoubleClick={() => onOpenDetails(row)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => setSelected((current) => (current.includes(row.id) ? current.filter((value) => value !== row.id) : [...current, row.id]))}
                  />
                </td>
                <td>
                  <select className={`status-select ${row.status}`} value={row.status} onChange={(event) => updateStatus(row.id, event.target.value as MovementStatus)}>
                    {movementStatus.map((value) => (
                      <option key={value} value={value}>
                        {movementStatusText[value][language]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="link-button" type="button" onClick={() => onOpenDetails(row)}>
                    {row.no}
                  </button>
                </td>
                <td>{row.partner}</td>
                <td>{row.itemSummary}</td>
                <td className="numeric">{formatNumber(row.totalAmount)}</td>
                <td>{row.memo}</td>
                <td>{row.expectedDate || '-'}</td>
                <td>{row.actualDate || '-'}</td>
                <td className="row-actions">
                  <button type="button" onClick={() => removeRow(row.id)} aria-label="Delete">
                    <Trash2 size={16} />
                  </button>
                  <button type="button" onClick={() => onOpenDetails(row)} aria-label="Open">
                    <ChevronDown size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MovementCreateDialog
        open={createOpen}
        direction={direction}
        onClose={() => setCreateOpen(false)}
        onCreate={(order) => {
          onRowsChange([order, ...rows])
          setCreateOpen(false)
          onToast(t('saved'), 'success')
        }}
        t={t}
      />
      <AiInboundDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onCreate={(order) => {
          onRowsChange([order, ...rows])
          setAiOpen(false)
          onToast(t('aiInbound'), 'success')
        }}
        t={t}
      />
      <SimpleDialog open={importOpen} title={t('import')} onClose={() => setImportOpen(false)} t={t}>
        <div className="drop-zone">
          <FileInput size={28} />
          <p>CSV / XLSX / EDI / ASN</p>
          <input
            type="file"
            onChange={() => {
              setImportOpen(false)
              onToast(t('import'), 'success')
            }}
          />
        </div>
      </SimpleDialog>
    </section>
  )
}

function PageTitle({ title, count, actions, t }: { title: string; count: number; actions: ReactNode; t: (key: string) => string }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <span className="count-pill">{formatNumber(count)} {t('total')}</span>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  )
}

function DateStrip({
  buckets,
  activeDate,
  setActiveDate,
  t,
}: {
  buckets: DayBucket[]
  activeDate: string
  setActiveDate: (date: string) => void
  t: (key: string) => string
}) {
  return (
    <div className="date-strip">
      <button type="button" onClick={() => setActiveDate('')}>
        <ChevronLeft size={18} />
      </button>
      {buckets.map((bucket) => (
        <button
          key={bucket.date}
          className={`date-card ${activeDate === bucket.date ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveDate(activeDate === bucket.date ? '' : bucket.date)}
        >
          <span>{bucket.label}</span>
          <strong>{t('planned')} {bucket.planned}</strong>
          <strong>{t('done')} {bucket.done}</strong>
        </button>
      ))}
      <button type="button" onClick={() => setActiveDate('')}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function OperationBoard({
  title,
  actions,
  onAction,
}: {
  title: string
  actions: { label: string; icon: ReactNode }[]
  onAction: (label: string) => void
}) {
  return (
    <section className="operation-board" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <span>{actions.length}</span>
      </header>
      <div>
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={() => onAction(action.label)}>
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function Pagination() {
  return (
    <div className="pagination">
      <button type="button" disabled>
        <ChevronLeft size={15} />
      </button>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((page) => (
        <button key={page} className={page === 1 ? 'active' : ''} type="button">
          {page}
        </button>
      ))}
      <span>...</span>
      <button type="button">121</button>
      <button type="button">
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

function InventoryCreateDialog({
  open,
  language,
  onClose,
  onCreate,
  t,
}: {
  open: boolean
  language: Language
  onClose: () => void
  onCreate: (item: InventoryItem) => void
  t: (key: string) => string
}) {
  const [title, setTitle] = useState('New AMR spare kit')
  const [sku, setSku] = useState('SP-AMR-001')
  const [quantity, setQuantity] = useState(24)
  const [owner, setOwner] = useState('JAML')

  return (
    <SimpleDialog open={open} title={t('newRegistration')} onClose={onClose} t={t}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate({
            id: String(Date.now()).slice(-8),
            sku,
            title,
            category: language === 'en' ? 'Spare parts' : '補修部品',
            subcategory: 'WMS 3.0',
            owner,
            maker: 'Item Robotics',
            warehouseId: 'tokyo-dc',
            zone: 'N-NEW',
            location: 'N01-01-01',
            lot: `LOT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
            available: quantity,
            reserved: 0,
            onHand: quantity,
            safetyStock: 4,
            unit: 'ea',
            quality: 'A',
            status: 'available',
            lastUpdated: '2026-05-19 15:30',
            temperature: 'ambient',
            serialTracked: false,
            risk: 'low',
          })
        }}
      >
        <label>{t('itemName')}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>{t('managementCode')}<input value={sku} onChange={(event) => setSku(event.target.value)} /></label>
        <label>{t('owner')}<input value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
        <label>{t('quantity')}<input type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>{t('cancel')}</button>
          <button className="primary-button" type="submit"><Save size={16} />{t('create')}</button>
        </div>
      </form>
    </SimpleDialog>
  )
}

function MovementCreateDialog({
  open,
  direction,
  onClose,
  onCreate,
  t,
}: {
  open: boolean
  direction: 'inbound' | 'outbound'
  onClose: () => void
  onCreate: (order: MovementOrder) => void
  t: (key: string) => string
}) {
  const [partner, setPartner] = useState(direction === 'inbound' ? 'Libiao Robotics' : '西大島本社')
  const [itemSummary, setItemSummary] = useState('t-Sort 3D spare kit')
  const [quantity, setQuantity] = useState(10)
  return (
    <SimpleDialog open={open} title={t('newRegistration')} onClose={onClose} t={t}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate({
            id: `${direction}-${Date.now()}`,
            no: String(Math.floor(3000 + Math.random() * 800)),
            direction,
            status: 'planned',
            partner,
            itemSummary,
            totalAmount: 0,
            memo: direction === 'inbound' ? 'ASN manual registration' : 'Manual shipment',
            expectedDate: '2026-05-23',
            registeredBy: 'Operator',
            userGroup: direction === 'inbound' ? '入荷チーム' : '出荷チーム',
            priority: 'normal',
            sourceSystem: 'Manual',
            lines: [{ sku: 'AUTO-SKU', title: itemSummary, quantity }],
          })
        }}
      >
        <label>{direction === 'inbound' ? t('supplier') : t('consignee')}<input value={partner} onChange={(event) => setPartner(event.target.value)} /></label>
        <label>{t('includedItems')}<input value={itemSummary} onChange={(event) => setItemSummary(event.target.value)} /></label>
        <label>{t('quantity')}<input type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>{t('cancel')}</button>
          <button className="primary-button" type="submit"><Save size={16} />{t('create')}</button>
        </div>
      </form>
    </SimpleDialog>
  )
}

function AiInboundDialog({
  open,
  onClose,
  onCreate,
  t,
}: {
  open: boolean
  onClose: () => void
  onCreate: (order: MovementOrder) => void
  t: (key: string) => string
}) {
  const [text, setText] = useState('ASN: Libiao Robotics / A-13011 t-Sort 3D / qty 8 / expected 2026-05-24')
  return (
    <SimpleDialog open={open} title={t('aiInbound')} onClose={onClose} t={t}>
      <div className="ai-panel">
        <Sparkles size={24} />
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} />
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            onCreate({
              id: `ai-${Date.now()}`,
              no: String(Math.floor(4000 + Math.random() * 800)),
              direction: 'inbound',
              status: 'planned',
              partner: text.includes('Libiao') ? 'Libiao Robotics' : 'AI parsed supplier',
              itemSummary: text.includes('A-13011') ? 'A-13011 t-Sort 3D' : 'AI parsed item',
              totalAmount: 0,
              memo: 'Created by AI inbound parser',
              expectedDate: '2026-05-24',
              registeredBy: 'AI Copilot',
              userGroup: '入荷チーム',
              priority: 'normal',
              sourceSystem: 'AI',
              lines: [{ sku: 'A-13011', title: 't-Sort 3D', quantity: 8 }],
            })
          }
        >
          <Bot size={16} />
          {t('create')}
        </button>
      </div>
    </SimpleDialog>
  )
}

function BusinessDrawer({
  drawer,
  language,
  session,
  context,
  onClose,
  onToast,
  t,
}: {
  drawer: DrawerTarget
  language: Language
  session: AuthSession
  context: RuntimeContext
  onClose: () => void
  onToast: (message: string, tone?: Toast['tone']) => void
  t: (key: string) => string
}) {
  if (!drawer) return null
  const title = drawer.kind === 'inventory' ? drawer.item.title : `${drawer.item.direction.toUpperCase()} ${drawer.item.no}`

  async function sync() {
    if (!drawer) return
    const path = drawer.kind === 'inventory' ? '/inventory/sync' : `/${drawer.item.direction}-orders/sync`
    await syncRecord(path, drawer.item, session, context)
    onToast(t('synced'), 'success')
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{t('drawerTitle')}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')}><X size={19} /></button>
        </header>
        {drawer.kind === 'inventory' ? (
          <div className="detail-grid">
            <Metric label={t('inventoryId')} value={drawer.item.id} />
            <Metric label={t('managementCode')} value={drawer.item.sku} />
            <Metric label={t('onHand')} value={formatNumber(drawer.item.onHand)} />
            <Metric label={t('available')} value={formatNumber(drawer.item.available)} />
            <Metric label={t('reserved')} value={formatNumber(drawer.item.reserved)} />
            <Metric label={t('safetyStock')} value={formatNumber(drawer.item.safetyStock)} />
            <Metric label={t('status')} value={inventoryStatusText[drawer.item.status][language]} />
            <Metric label={t('risk')} value={riskText[drawer.item.risk][language]} />
          </div>
        ) : (
          <>
            <div className="detail-grid">
              <Metric label={t('partner')} value={drawer.item.partner} />
              <Metric label={t('status')} value={movementStatusText[drawer.item.status][language]} />
              <Metric label={t('registeredBy')} value={drawer.item.registeredBy} />
              <Metric label={t('userGroup')} value={drawer.item.userGroup} />
            </div>
            <h3>{t('lines')}</h3>
            <div className="line-list">
              {drawer.item.lines.map((line) => (
                <div key={`${line.sku}-${line.title}`}>
                  <strong>{line.sku}</strong>
                  <span>{line.title}</span>
                  <em>{line.shipped ?? line.received ?? 0}/{line.quantity}</em>
                </div>
              ))}
            </div>
          </>
        )}
        <h3>{t('auditTrail')}</h3>
        <ol className="audit-list">
          <li>IAM authorized request context: {context.tenantId}/{context.warehouseId}</li>
          <li>Ontology contract checked: APIEndpoint, BusinessObject, State</li>
          <li>Last operator action staged for sync</li>
        </ol>
        <button className="primary-button full" type="button" onClick={sync}>
          <RefreshCcw size={16} />
          {t('syncNow')}
        </button>
      </aside>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SettingsDialog({
  open,
  onClose,
  onSaved,
  t,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  t: (key: string) => string
}) {
  const current = getRuntimeConfig()
  const [iamBaseUrl, setIamBaseUrl] = useState(current.iamBaseUrl || '')
  const [wmsBaseUrl, setWmsBaseUrl] = useState(current.wmsBaseUrl || '')

  return (
    <SimpleDialog open={open} title={t('apiSettings')} onClose={onClose} t={t}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          localStorage.setItem('wms_iam_base_url', iamBaseUrl)
          localStorage.setItem('wms_api_base_url', wmsBaseUrl)
          onSaved()
          onClose()
        }}
      >
        <label>{t('iamBaseUrl')}<input value={iamBaseUrl} onChange={(event) => setIamBaseUrl(event.target.value)} placeholder="https://iam.company.com/api/v1" /></label>
        <label>{t('wmsBaseUrl')}<input value={wmsBaseUrl} onChange={(event) => setWmsBaseUrl(event.target.value)} placeholder="https://wms.company.com/api/v1" /></label>
        <p className="form-note">Production requests include Authorization, X-Tenant-Id, X-Warehouse-Id, and X-Locale headers.</p>
        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>{t('cancel')}</button>
          <button className="primary-button" type="submit"><Save size={16} />{t('save')}</button>
        </div>
      </form>
    </SimpleDialog>
  )
}

function HelpDrawer({ open, onClose, t, apiMode }: { open: boolean; onClose: () => void; t: (key: string) => string; apiMode: string }) {
  if (!open) return null
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer help-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{t('help')}</span>
            <h2>WMS 3.0 Runbook</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')}><X size={19} /></button>
        </header>
        <div className="runbook">
          <p><strong>{t('apiMode')}:</strong> {apiMode}</p>
          <p>1. IAM login is required before the workspace mounts.</p>
          <p>2. Tenant and warehouse selectors are part of every WMS adapter request.</p>
          <p>3. Inventory, inbound, and outbound screens support filtering, editing, import, export, details, and sync.</p>
          <p>4. Configure Production API URLs in settings to replace demo data.</p>
        </div>
      </aside>
    </div>
  )
}

function SimpleDialog({
  open,
  title,
  onClose,
  children,
  t,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  t: (key: string) => string
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function ToastView({ toast }: { toast: Toast }) {
  return (
    <div className={`toast ${toast.tone}`}>
      {toast.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      {toast.message}
    </div>
  )
}

function LanguageSelect({
  language,
  setLanguage,
  compact = false,
}: {
  language: Language
  setLanguage: (language: Language) => void
  compact?: boolean
}) {
  return (
    <label className={`language-select ${compact ? 'compact' : ''}`}>
      <Globe2 size={16} />
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {languages.map((candidate) => (
          <option key={candidate.code} value={candidate.code}>
            {candidate.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Logo() {
  return (
    <div className="logo-mark">
      <span className="logo-symbol" />
      <strong>item</strong>
      <em>WMS</em>
    </div>
  )
}

export default App
