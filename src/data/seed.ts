export type Language = 'zh' | 'en' | 'ja'

export type Warehouse = {
  id: string
  code: string
  name: string
  region: string
  capabilities: string[]
}

export type Tenant = {
  id: string
  code: string
  name: string
  warehouses: Warehouse[]
}

export type InventoryStatus = 'available' | 'allocated' | 'hold' | 'short' | 'inspection'

export type InventoryItem = {
  id: string
  sku: string
  title: string
  category: string
  subcategory: string
  owner: string
  maker: string
  warehouseId: string
  zone: string
  location: string
  lot: string
  available: number
  reserved: number
  onHand: number
  safetyStock: number
  unit: string
  quality: 'A' | 'B' | 'C' | 'Q'
  status: InventoryStatus
  lastUpdated: string
  temperature: 'ambient' | 'cold' | 'hazmat'
  serialTracked: boolean
  risk: 'low' | 'medium' | 'high'
}

export type MovementStatus =
  | 'draft'
  | 'planned'
  | 'ordered'
  | 'processing'
  | 'completed'
  | 'exception'

export type MovementLine = {
  sku: string
  title: string
  quantity: number
  received?: number
  shipped?: number
  location?: string
}

export type MovementOrder = {
  id: string
  no: string
  direction: 'inbound' | 'outbound'
  status: MovementStatus
  partner: string
  itemSummary: string
  totalAmount: number
  memo: string
  expectedDate: string
  actualDate?: string
  registeredBy: string
  userGroup: string
  priority: 'normal' | 'rush' | 'hold'
  sourceSystem: 'OMS' | 'EDI' | 'Manual' | 'AI'
  lines: MovementLine[]
}

export type DayBucket = {
  date: string
  label: string
  planned: number
  done: number
}

export const tenants: Tenant[] = [
  {
    id: 'tenant-item',
    code: 'ITEM',
    name: 'item Inc. Operations',
    warehouses: [
      {
        id: 'item-hq-lab',
        code: 'ITEM-LAB',
        name: 'Item AI Fulfillment Lab',
        region: 'US-West',
        capabilities: ['WMS 3.0', 'IAM', 'AI orchestration'],
      },
      {
        id: 'item-global-hub',
        code: 'ITEM-HUB',
        name: 'Item Global Integration Hub',
        region: 'JP-Tokyo',
        capabilities: ['API sandbox', 'Integration test', 'Master data'],
      },
    ],
  },
  {
    id: 'tenant-plus',
    code: 'PLUS',
    name: 'プラスオートメーション株式会社',
    warehouses: [
      {
        id: 'tokyo-dc',
        code: 'JAML-TYO',
        name: 'Tokyo East Robotics DC',
        region: 'JP-Kanto',
        capabilities: ['AMR', 'Sortation', 'Cold chain'],
      },
      {
        id: 'osaka-dc',
        code: 'PLUS-OSA',
        name: 'Osaka Fulfillment Center',
        region: 'JP-Kansai',
        capabilities: ['Piece pick', 'VAS', 'Returns'],
      },
    ],
  },
  {
    id: 'tenant-bnp',
    code: 'BNP',
    name: 'BNP PayandBill Logistics',
    warehouses: [
      {
        id: 'sg-hub',
        code: 'BNP-SG1',
        name: 'Singapore Crossdock Hub',
        region: 'SG-West',
        capabilities: ['Crossdock', 'Bonded', 'Parcel'],
      },
    ],
  },
]

export const inventorySeed: InventoryItem[] = [
  {
    id: '38619243',
    sku: 'A-02811',
    title: '西大島本社-t-Sort sd5',
    category: '販売資産',
    subcategory: 'サブスク資産',
    owner: 'JAML',
    maker: 'Libiao',
    warehouseId: 'tokyo-dc',
    zone: 'A-SORT',
    location: 'A01-02-05',
    lot: 'LOT-20260513',
    available: 48,
    reserved: 8,
    onHand: 56,
    safetyStock: 20,
    unit: 'ea',
    quality: 'A',
    status: 'available',
    lastUpdated: '2026-05-19 13:42',
    temperature: 'ambient',
    serialTracked: true,
    risk: 'low',
  },
  {
    id: '62021673',
    sku: 'A-13011',
    title: 'しまうまプリント_熊本ACC002384t-Sort 3D',
    category: '販売資産',
    subcategory: 'サブスク資産',
    owner: 'プラスA',
    maker: 'Libiao',
    warehouseId: 'tokyo-dc',
    zone: 'B-AMR',
    location: 'B07-01-12',
    lot: 'LOT-20260517',
    available: 18,
    reserved: 10,
    onHand: 28,
    safetyStock: 16,
    unit: 'ea',
    quality: 'A',
    status: 'allocated',
    lastUpdated: '2026-05-19 11:08',
    temperature: 'ambient',
    serialTracked: true,
    risk: 'medium',
  },
  {
    id: '62021670',
    sku: 'A-13008',
    title: 'しまうまプリント_熊本ACC002384t-Sort 3D',
    category: '販売資産',
    subcategory: 'サブスク資産',
    owner: 'プラスA',
    maker: 'Libiao',
    warehouseId: 'tokyo-dc',
    zone: 'B-AMR',
    location: 'B07-01-09',
    lot: 'LOT-20260517',
    available: 3,
    reserved: 5,
    onHand: 8,
    safetyStock: 12,
    unit: 'ea',
    quality: 'Q',
    status: 'inspection',
    lastUpdated: '2026-05-18 17:31',
    temperature: 'ambient',
    serialTracked: true,
    risk: 'high',
  },
  {
    id: '41840301',
    sku: 'A-05263',
    title: '坂角総本舗_東海センター_初期導入t-Sort cb15（グリーンベルト）',
    category: '販売資産',
    subcategory: 'サブスク資産',
    owner: 'JAML',
    maker: 'Libiao',
    warehouseId: 'tokyo-dc',
    zone: 'C-PICK',
    location: 'C02-09-01',
    lot: 'LOT-20260510',
    available: 72,
    reserved: 0,
    onHand: 72,
    safetyStock: 30,
    unit: 'ea',
    quality: 'A',
    status: 'available',
    lastUpdated: '2026-05-18 09:12',
    temperature: 'ambient',
    serialTracked: false,
    risk: 'low',
  },
  {
    id: '58716376',
    sku: 'A-12022',
    title: '西大島本社ACC001160t-Sort cb15（グリーンベルト）',
    category: '補修部品',
    subcategory: 'コンベア',
    owner: 'プラスA',
    maker: 'Libiao',
    warehouseId: 'osaka-dc',
    zone: 'R-VAS',
    location: 'R11-03-04',
    lot: 'LOT-20260508',
    available: 9,
    reserved: 4,
    onHand: 13,
    safetyStock: 18,
    unit: 'ea',
    quality: 'B',
    status: 'short',
    lastUpdated: '2026-05-17 21:54',
    temperature: 'ambient',
    serialTracked: false,
    risk: 'high',
  },
  {
    id: '62021640',
    sku: 'A-12979',
    title: '西大島本社ACC001160t-Sort cb15（グリーンベルト）',
    category: '補修部品',
    subcategory: 'コンベア',
    owner: 'プラスA',
    maker: 'Libiao',
    warehouseId: 'osaka-dc',
    zone: 'R-VAS',
    location: 'R11-03-08',
    lot: 'LOT-20260512',
    available: 22,
    reserved: 2,
    onHand: 24,
    safetyStock: 18,
    unit: 'ea',
    quality: 'A',
    status: 'available',
    lastUpdated: '2026-05-19 08:28',
    temperature: 'ambient',
    serialTracked: false,
    risk: 'low',
  },
  {
    id: 'SG-88102',
    sku: 'RBT-2400',
    title: 'Autonomous Mobile Robot, payload 2400',
    category: 'Robot',
    subcategory: 'AMR',
    owner: 'BNP',
    maker: 'Locus',
    warehouseId: 'sg-hub',
    zone: 'X-DOCK',
    location: 'X01-01-02',
    lot: 'LOT-20260519',
    available: 14,
    reserved: 1,
    onHand: 15,
    safetyStock: 6,
    unit: 'ea',
    quality: 'A',
    status: 'available',
    lastUpdated: '2026-05-19 10:05',
    temperature: 'ambient',
    serialTracked: true,
    risk: 'low',
  },
]

export const inboundSeed: MovementOrder[] = [
  {
    id: 'ib-2375',
    no: '2375',
    direction: 'inbound',
    status: 'completed',
    partner: '関西物流展2026',
    itemSummary: 'タブレット',
    totalAmount: 0,
    memo: '展示戻り検品済み',
    expectedDate: '2026-05-13',
    actualDate: '2026-05-13',
    registeredBy: 'Tanaka',
    userGroup: '経営管理部',
    priority: 'normal',
    sourceSystem: 'Manual',
    lines: [{ sku: 'TAB-2026', title: 'タブレット', quantity: 12, received: 12, location: 'A01-01-01' }],
  },
  {
    id: 'ib-2374',
    no: '2374',
    direction: 'inbound',
    status: 'completed',
    partner: '坂角総本舗_東海センター 初期導入',
    itemSummary: 't-Sort cb15（グリーンベルト）',
    totalAmount: 0,
    memo: '-',
    expectedDate: '2026-05-19',
    actualDate: '2026-05-19',
    registeredBy: 'Sato',
    userGroup: '入荷チーム',
    priority: 'normal',
    sourceSystem: 'EDI',
    lines: [{ sku: 'A-05263', title: 't-Sort cb15（グリーンベルト）', quantity: 72, received: 72, location: 'C02-09-01' }],
  },
  {
    id: 'ib-2378',
    no: '2378',
    direction: 'inbound',
    status: 'planned',
    partner: 'Libiao Robotics',
    itemSummary: 't-Sort sd5, t-Sort 3D',
    totalAmount: 1280000,
    memo: 'AI OCR imported from ASN',
    expectedDate: '2026-05-21',
    registeredBy: 'AI Copilot',
    userGroup: '入荷チーム',
    priority: 'rush',
    sourceSystem: 'AI',
    lines: [
      { sku: 'A-02811', title: 't-Sort sd5', quantity: 12 },
      { sku: 'A-13011', title: 't-Sort 3D', quantity: 8 },
    ],
  },
  {
    id: 'ib-2381',
    no: '2381',
    direction: 'inbound',
    status: 'exception',
    partner: 'しまうまプリント_熊本',
    itemSummary: 't-Sort 3D spare kit',
    totalAmount: 242000,
    memo: '数量差異: ASN 20 / received 18',
    expectedDate: '2026-05-22',
    actualDate: '2026-05-22',
    registeredBy: 'Yamada',
    userGroup: '品質管理',
    priority: 'hold',
    sourceSystem: 'OMS',
    lines: [{ sku: 'SP-3D-KIT', title: 't-Sort 3D spare kit', quantity: 20, received: 18, location: 'Q01-01-03' }],
  },
]

export const outboundSeed: MovementOrder[] = [
  {
    id: 'ob-2881',
    no: '2881',
    direction: 'outbound',
    status: 'completed',
    partner: '【LANXIN】アンドエスティー_藤岡',
    itemSummary: 'PC防塵カバー/キーボードカバー一式',
    totalAmount: 0,
    memo: '-',
    expectedDate: '2026-05-19',
    actualDate: '2026-05-19',
    registeredBy: 'Suzuki',
    userGroup: '出荷チーム',
    priority: 'normal',
    sourceSystem: 'OMS',
    lines: [{ sku: 'PC-COVER', title: 'PC防塵カバー', quantity: 8, shipped: 8, location: 'R02-02-02' }],
  },
  {
    id: 'ob-2880',
    no: '2880',
    direction: 'outbound',
    status: 'completed',
    partner: '【LANXIN】アンドエスティー_藤岡',
    itemSummary: 'Autonomous Mobile Robot, AMR battery',
    totalAmount: 0,
    memo: '-',
    expectedDate: '2026-05-19',
    actualDate: '2026-05-19',
    registeredBy: 'Suzuki',
    userGroup: '出荷チーム',
    priority: 'normal',
    sourceSystem: 'OMS',
    lines: [{ sku: 'RBT-2400', title: 'Autonomous Mobile Robot', quantity: 2, shipped: 2, location: 'X01-01-02' }],
  },
  {
    id: 'ob-2879',
    no: '2879',
    direction: 'outbound',
    status: 'processing',
    partner: 'しまうまプリント_熊本',
    itemSummary: 't-Sort 3D, t-Sort 3D',
    totalAmount: 0,
    memo: '全2点',
    expectedDate: '2026-05-20',
    registeredBy: 'Tanaka',
    userGroup: '出荷チーム',
    priority: 'rush',
    sourceSystem: 'EDI',
    lines: [
      { sku: 'A-13011', title: 't-Sort 3D', quantity: 3, shipped: 2, location: 'B07-01-12' },
      { sku: 'A-13008', title: 't-Sort 3D', quantity: 2, shipped: 0, location: 'B07-01-09' },
    ],
  },
  {
    id: 'ob-2878',
    no: '2878',
    direction: 'outbound',
    status: 'planned',
    partner: '西大島本社',
    itemSummary: '3Dソーター用電源コード4m, 3Dハーネス',
    totalAmount: 0,
    memo: '補修部品',
    expectedDate: '2026-05-23',
    registeredBy: 'Kobayashi',
    userGroup: '補修部品',
    priority: 'normal',
    sourceSystem: 'Manual',
    lines: [{ sku: 'SP-CORD-4M', title: '3Dソーター用電源コード4m', quantity: 10 }],
  },
]

export const inboundBuckets: DayBucket[] = [
  { date: '2026-05-17', label: '05/17(日)', planned: 0, done: 0 },
  { date: '2026-05-18', label: '05/18(月)', planned: 0, done: 3 },
  { date: '2026-05-19', label: '05/19(火)', planned: 0, done: 3 },
  { date: '2026-05-20', label: '今日', planned: 0, done: 0 },
  { date: '2026-05-21', label: '05/21(木)', planned: 1, done: 0 },
  { date: '2026-05-22', label: '05/22(金)', planned: 1, done: 0 },
  { date: '2026-05-23', label: '05/23(土)', planned: 0, done: 0 },
]

export const outboundBuckets: DayBucket[] = [
  { date: '2026-05-17', label: '05/17(日)', planned: 0, done: 0 },
  { date: '2026-05-18', label: '05/18(月)', planned: 0, done: 0 },
  { date: '2026-05-19', label: '05/19(火)', planned: 0, done: 2 },
  { date: '2026-05-20', label: '今日', planned: 1, done: 0 },
  { date: '2026-05-21', label: '05/21(木)', planned: 0, done: 0 },
  { date: '2026-05-22', label: '05/22(金)', planned: 0, done: 0 },
  { date: '2026-05-23', label: '05/23(土)', planned: 1, done: 0 },
]
