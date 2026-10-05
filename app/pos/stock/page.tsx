'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Layers, X, Ban, CheckCircle2, AlertTriangle, Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, PackagePlus, SlidersHorizontal, Package } from 'lucide-react'
import { supabase } from '../../supabase'

const PRESET_EMOJIS = ['🍾', '🍺', '🥃', '🧊', '🥤', '🍷', '🍸', '🍟', '🍗', '🍕', '🍉', '⚡', '🍹', '🥜']

export default function InventoryPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  
  const [loadingCats, setLoadingCats] = useState(true)
  const [loadingProds, setLoadingProds] = useState(true)
  const [loadingStocks, setLoadingStocks] = useState(true)

  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'stocks'>('products')
  
  // --- SEARCH & SORT STATE (Products) ---
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'name' | 'category' | 'normalPrice' | 'tournamentPrice'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // --- SEARCH, FILTER & SORT STATE (Stocks) ---
  const [stockSearchQuery, setStockSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all')
  const [stockSortField, setStockSortField] = useState<'name' | 'category' | 'currentQty' | 'minimumQty' | 'status'>('name')
  const [stockSortDirection, setStockSortDirection] = useState<'asc' | 'desc'>('asc')

  // Product Modal State
  const [openProductModal, setOpenProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [prodName, setProdName] = useState('')
  const [prodCategoryId, setProdCategoryId] = useState<string>('')
  const [prodNormalPrice, setProdNormalPrice] = useState('')
  const [prodTournamentPrice, setProdTournamentPrice] = useState('')

  // Category Modal State
  const [openCatModal, setOpenCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<any>(null)
  const [catName, setCatName] = useState('')
  const [catIcon, setCatIcon] = useState('🍾')

  // Stock Modal State (Stock In / Adjust)
  const [stockModal, setStockModal] = useState<{
    isOpen: boolean
    mode: 'in' | 'adjust' | null
    product: any | null
  }>({
    isOpen: false,
    mode: null,
    product: null
  })
  const [stockInputQty, setStockInputQty] = useState('')
  const [stockNote, setStockNote] = useState('')

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'product' | 'category' | null
    id: string | null
    name: string
  }>({
    isOpen: false,
    type: null,
    id: null,
    name: ''
  })

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    fetchStocks()
  }, [])

  const fetchCategories = async () => {
    setLoadingCats(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching categories:', error.message)
      } else if (data) {
        const formatted = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
          color: item.color || 'from-amber-500 to-orange-600',
          sortOrder: item.sort_order ?? 0,
          isActive: item.is_active ?? true
        }))
        setCategories(formatted)
        if (formatted.length > 0 && !prodCategoryId) {
          setProdCategoryId(formatted[0].id)
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching categories:', err)
    } finally {
      setLoadingCats(false)
    }
  }

  const fetchProducts = async () => {
    setLoadingProds(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')

      if (error) {
        console.error('Error fetching products:', error.message)
      } else if (data) {
        const formatted = data.map((item: any) => ({
          id: item.id,
          categoryId: item.category_id,
          name: item.name,
          normalPrice: item.normal_price ?? 0,
          tournamentPrice: item.tournament_price ?? item.normal_price ?? 0,
          isActive: item.is_active ?? true
        }))
        setProducts(formatted)
      }
    } catch (err) {
      console.error('Unexpected error fetching products:', err)
    } finally {
      setLoadingProds(false)
    }
  }

  const fetchStocks = async () => {
    setLoadingStocks(true)
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('*')

      if (error) {
        console.error('Error fetching stocks:', error.message)
      } else if (data) {
        const formatted = data.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          currentQty: item.current_qty ?? 0,
          minimumQty: item.minimum_qty ?? 5,
          lastAdjustedAt: item.last_adjusted_at
        }))
        setStocks(formatted)
      }
    } catch (err) {
      console.error('Unexpected error fetching stocks:', err)
    } finally {
      setLoadingStocks(false)
    }
  }

  // --- HANDLERS: Product ---
  const handleOpenAddProduct = () => {
    setEditingProduct(null)
    setProdName('')
    setProdCategoryId(categories[0]?.id || '')
    setProdNormalPrice('')
    setProdTournamentPrice('')
    setOpenProductModal(true)
  }

  const handleOpenEditProduct = (prod: any) => {
    setEditingProduct(prod)
    setProdName(prod.name)
    setProdCategoryId(prod.categoryId)
    setProdNormalPrice(String(prod.normalPrice))
    setProdTournamentPrice(String(prod.tournamentPrice))
    setOpenProductModal(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prodName.trim() || !prodNormalPrice) return

    const payload = {
      name: prodName.trim(),
      category_id: prodCategoryId,
      normal_price: Number(prodNormalPrice),
      tournament_price: prodTournamentPrice ? Number(prodTournamentPrice) : Number(prodNormalPrice),
      is_active: true,
      updated_at: new Date().toISOString()
    }

    let savedProductId = ''

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)

      if (error) {
        alert('เกิดข้อผิดพลาดในการแก้ไขสินค้า: ' + error.message)
        return
      }
      savedProductId = editingProduct.id
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()

      if (error) {
        alert('เกิดข้อผิดพลาดในการเพิ่มสินค้า: ' + error.message)
        return
      }
      if (data && data[0]) {
        savedProductId = data[0].id
        await supabase.from('stocks').insert([{
          product_id: savedProductId,
          current_qty: 0,
          minimum_qty: 5
        }])
      }
    }

    setOpenProductModal(false)
    fetchProducts()
    fetchStocks()
  }

  const handleToggleProductStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('products')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      alert('ไม่สามารถเปลี่ยนสถานะได้: ' + error.message)
    } else {
      fetchProducts()
    }
  }

  // --- HANDLERS: Category ---
  const handleOpenAddCat = () => {
    setEditingCat(null)
    setCatName('')
    setCatIcon('🍾')
    setOpenCatModal(true)
  }

  const handleOpenEditCat = (cat: any) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatIcon(cat.icon)
    setOpenCatModal(true)
  }

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catName.trim()) return

    if (editingCat) {
      const { error } = await supabase
        .from('categories')
        .update({ name: catName.trim(), icon: catIcon, updated_at: new Date().toISOString() })
        .eq('id', editingCat.id)

      if (error) {
        alert('เกิดข้อผิดพลาดในการแก้ไข: ' + error.message)
        return
      }
    } else {
      const newSortOrder = categories.length + 1
      const { error } = await supabase
        .from('categories')
        .insert([{ name: catName.trim(), icon: catIcon, color: 'from-amber-500 to-orange-600', sort_order: newSortOrder, is_active: true }])

      if (error) {
        alert('เกิดข้อผิดพลาดในการเพิ่ม: ' + error.message)
        return
      }
    }
    setOpenCatModal(false)
    fetchCategories()
  }

  const handleToggleCatStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('categories')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) fetchCategories()
  }

  // --- HANDLERS: Stock (IN / ADJUST / MIN QTY) ---
  const handleOpenStockModal = (product: any, mode: 'in' | 'adjust') => {
    const currentStock = stocks.find(s => s.productId === product.id)?.currentQty || 0
    setStockModal({
      isOpen: true,
      mode,
      product
    })
    setStockInputQty(mode === 'adjust' ? String(currentStock) : '')
    setStockNote(mode === 'in' ? 'รับสินค้าเข้าสต็อก' : 'ปรับปรุงยอดสต็อก')
  }

  const handleUpdateMinimumQty = async (productId: string, newMinQty: number) => {
    setStocks(prev => prev.map(s => s.productId === productId ? { ...s, minimumQty: newMinQty } : s))

    const existingStock = stocks.find(s => s.productId === productId)
    if (existingStock) {
      await supabase
        .from('stocks')
        .update({ minimum_qty: newMinQty, updated_at: new Date().toISOString() })
        .eq('product_id', productId)
    } else {
      await supabase
        .from('stocks')
        .insert([{ product_id: productId, current_qty: 0, minimum_qty: newMinQty }])
    }
  }

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockModal.product || stockInputQty === '') return

    const product = stockModal.product
    const existingStock = stocks.find(s => s.productId === product.id)
    const currentQty = existingStock ? existingStock.currentQty : 0
    const inputVal = Number(stockInputQty)

    let newQty = 0
    let movementType = ''
    let qtyChange = 0

    if (stockModal.mode === 'in') {
      if (inputVal <= 0) return alert('กรุณากรอกจำนวนมากกว่า 0')
      qtyChange = inputVal
      newQty = currentQty + inputVal
      movementType = 'IN'
    } else {
      if (inputVal < 0) return alert('จำนวนสต็อกต้องไม่ติดลบ')
      newQty = inputVal
      qtyChange = newQty - currentQty
      movementType = 'ADJUST'
    }

    if (existingStock) {
      const { error: stockErr } = await supabase
        .from('stocks')
        .update({
          current_qty: newQty,
          last_adjusted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('product_id', product.id)

      if (stockErr) {
        alert('อัปเดตสต็อกไม่สำเร็จ: ' + stockErr.message)
        return
      }
    } else {
      const { error: stockErr } = await supabase
        .from('stocks')
        .insert([{
          product_id: product.id,
          current_qty: newQty,
          minimum_qty: 5,
          last_adjusted_at: new Date().toISOString()
        }])

      if (stockErr) {
        alert('สร้างข้อมูลสต็อกไม่สำเร็จ: ' + stockErr.message)
        return
      }
    }

    await supabase.from('stock_movements').insert([{
      product_id: product.id,
      type: movementType,
      quantity: Math.abs(qtyChange),
      balance_before: currentQty,
      balance_after: newQty,
      note: stockNote.trim() || (movementType === 'IN' ? 'รับสินค้าเข้า' : 'ปรับสต็อกตรง'),
      created_at: new Date().toISOString()
    }])

    setStockModal({ isOpen: false, mode: null, product: null })
    fetchStocks()
  }

  // --- DELETE HANDLER ---
  const confirmDelete = async () => {
    if (deleteModal.type === 'category' && deleteModal.id !== null) {
      const { error } = await supabase.from('categories').delete().eq('id', deleteModal.id)
      if (error) alert('ลบหมวดหมู่ไม่สำเร็จ: ' + error.message)
      fetchCategories()
    } else if (deleteModal.type === 'product' && deleteModal.id !== null) {
      await supabase.from('stocks').delete().eq('product_id', deleteModal.id)
      const { error } = await supabase.from('products').delete().eq('id', deleteModal.id)
      if (error) alert('ลบสินค้าไม่สำเร็จ: ' + error.message)
      fetchProducts()
      fetchStocks()
    }
    setDeleteModal({ isOpen: false, type: null, id: null, name: '' })
  }

  // --- FILTER & SORT LOGIC (Products) ---
  const handleSort = (field: 'name' | 'category' | 'normalPrice' | 'tournamentPrice') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredProducts = products.filter(prod => {
    const cat = categories.find(c => c.id === prod.categoryId)
    const q = searchQuery.toLowerCase()
    const matchName = prod.name.toLowerCase().includes(q)
    const matchCat = cat ? cat.name.toLowerCase().includes(q) : false
    return matchName || matchCat
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA: any = ''
    let valB: any = ''

    if (sortField === 'name') {
      valA = a.name
      valB = b.name
    } else if (sortField === 'category') {
      valA = categories.find(c => c.id === a.categoryId)?.name || ''
      valB = categories.find(c => c.id === b.categoryId)?.name || ''
    } else if (sortField === 'normalPrice') {
      valA = a.normalPrice
      valB = b.normalPrice
    } else if (sortField === 'tournamentPrice') {
      valA = a.tournamentPrice
      valB = b.tournamentPrice
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // --- FILTER & SORT LOGIC (Stocks) ---
  const handleStockSort = (field: 'name' | 'category' | 'currentQty' | 'minimumQty' | 'status') => {
    if (stockSortField === field) {
      setStockSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setStockSortField(field)
      setStockSortDirection('asc')
    }
  }

  const filteredStocks = products.filter(prod => {
    const cat = categories.find(c => c.id === prod.categoryId)
    const q = stockSearchQuery.toLowerCase()
    const matchName = prod.name.toLowerCase().includes(q)
    const matchCat = cat ? cat.name.toLowerCase().includes(q) : false

    const st = stocks.find(s => s.productId === prod.id)
    const qty = st ? st.currentQty : 0
    const minQty = st ? st.minimumQty : 5

    if (stockFilter === 'low_stock') {
      return (matchName || matchCat) && qty <= minQty
    } else if (stockFilter === 'out_of_stock') {
      return (matchName || matchCat) && qty === 0
    }
    return matchName || matchCat
  })

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    const catA = categories.find(c => c.id === a.categoryId)?.name || ''
    const catB = categories.find(c => c.id === b.categoryId)?.name || ''
    const stA = stocks.find(s => s.productId === a.id)
    const stB = stocks.find(s => s.productId === b.id)
    const qtyA = stA ? stA.currentQty : 0
    const qtyB = stB ? stB.currentQty : 0
    const minA = stA ? stA.minimumQty : 5
    const minB = stB ? stB.minimumQty : 5

    let valA: any = ''
    let valB: any = ''

    if (stockSortField === 'name') {
      valA = a.name
      valB = b.name
    } else if (stockSortField === 'category') {
      valA = catA
      valB = catB
    } else if (stockSortField === 'currentQty') {
      valA = qtyA
      valB = qtyB
    } else if (stockSortField === 'minimumQty') {
      valA = minA
      valB = minB
    } else if (stockSortField === 'status') {
      // จัดลำดับสถานะ: หมด (0) -> ใกล้หมด (<=min) -> ปกติ (>min)
      const getStatusRank = (q: number, m: number) => (q === 0 ? 0 : q <= m ? 1 : 2)
      valA = getStatusRank(qtyA, minA)
      valB = getStatusRank(qtyB, minB)
    }

    if (valA < valB) return stockSortDirection === 'asc' ? -1 : 1
    if (valA > valB) return stockSortDirection === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto pb-12 px-4 md:px-0">
      {/* ส่วนหัวข้อหลัก */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-xl gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            จัดการสต็อกและสินค้า (Product & Inventory)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            จัดการรายการสินค้า ราคา หมวดหมู่ และตรวจสอบจำนวนสต็อกคงเหลือพร้อมรับเข้า-ปรับปรุง
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end flex-wrap gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex space-x-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${activeTab === 'products' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              สินค้าทั้งหมด
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${activeTab === 'categories' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              หมวดหมู่
            </button>
            <button
              onClick={() => setActiveTab('stocks')}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${activeTab === 'stocks' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              สต็อกคงเหลือ
            </button>
          </div>

          {activeTab === 'products' && (
            <button
              onClick={handleOpenAddProduct}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center space-x-1 text-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={18} />
              <span>เพิ่มสินค้า</span>
            </button>
          )} 
          {activeTab === 'categories' && (
            <button
              onClick={handleOpenAddCat}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center space-x-1 text-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={18} />
              <span>เพิ่มหมวดหมู่</span>
            </button>
          )}
        </div>
      </div>

      {/* --- TAB 1: รายการสินค้า (Products) --- */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-slate-200 flex items-center space-x-2">
              <Layers size={18} className="text-amber-400" />
              <span>รายการสินค้าทั้งหมด ({sortedProducts.length})</span>
            </h3>
            <div className="relative w-full md:w-72">
              <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า หรือ หมวดหมู่..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 text-xs border-b border-slate-800 uppercase tracking-wider select-none">
                  <th onClick={() => handleSort('name')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center space-x-1">
                      <span>ชื่อสินค้า</span>
                      {sortField === 'name' ? (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('category')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center space-x-1">
                      <span>หมวดหมู่</span>
                      {sortField === 'category' ? (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('normalPrice')} className="p-4 text-right cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center justify-end space-x-1">
                      <span>ราคาปกติ</span>
                      {sortField === 'normalPrice' ? (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('tournamentPrice')} className="p-4 text-right cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center justify-end space-x-1">
                      <span>ราคา TOURNAMENT ⭐</span>
                      {sortField === 'tournamentPrice' ? (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th className="p-4 text-center">สถานะ</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {loadingProds ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 size={20} className="animate-spin text-amber-500" />
                        <span>กำลังโหลดข้อมูลสินค้า...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      ไม่พบสินค้าในฐานข้อมูล
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((prod) => {
                    const cat = categories.find(c => c.id === prod.categoryId)
                    return (
                      <tr key={prod.id} className={`hover:bg-slate-800/40 transition ${!prod.isActive ? 'opacity-60 bg-slate-950/40' : ''}`}>
                        <td className="p-4 font-semibold text-slate-100">{prod.name}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-xs rounded-lg text-slate-300">
                            {cat ? `${cat.icon} ${cat.name}` : 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-200">
                          {prod.normalPrice.toLocaleString()} ฿
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-amber-400">
                          {prod.tournamentPrice.toLocaleString()} ฿
                        </td>
                        <td className="p-4 text-center">
                          {prod.isActive ? (
                            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full font-medium">
                              เปิดขาย
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded-full font-medium">
                              บล็อกการขาย
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleToggleProductStatus(prod.id, prod.isActive)}
                              className={`p-2 rounded-lg transition cursor-pointer ${prod.isActive ? 'bg-slate-800 hover:bg-amber-950/50 text-amber-400' : 'bg-slate-800 hover:bg-emerald-950/50 text-emerald-400'}`}
                              title={prod.isActive ? 'บล็อกการขาย' : 'เปิดใช้งาน'}
                            >
                              <Ban size={15} />
                            </button>
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition cursor-pointer"
                              title="แก้ไขสินค้า"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, type: 'product', id: prod.id, name: prod.name })}
                              className="p-2 bg-slate-800 hover:bg-red-950/50 text-red-400 rounded-lg transition cursor-pointer"
                              title="ลบสินค้า"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: หมวดหมู่ (Categories) --- */}
      {activeTab === 'categories' && (
        <div>
          {loadingCats ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
              <Loader2 size={36} className="animate-spin text-amber-500" />
              <p>กำลังโหลดข้อมูลหมวดหมู่...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-3xl">📦</div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">ยังไม่มีหมวดหมู่สินค้าในฐานข้อมูล</h3>
                <p className="text-slate-400 text-sm mt-1">เริ่มต้นสร้างหมวดหมู่แรกของคุณได้เลย</p>
              </div>
              <button
                onClick={handleOpenAddCat}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg cursor-pointer inline-flex items-center space-x-2"
              >
                <Plus size={18} />
                <span>เพิ่มหมวดหมู่แรก</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat) => (
                <div key={cat.id} className={`border rounded-2xl p-6 flex flex-col justify-between shadow-xl transition-all ${cat.isActive ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-950/80 border-red-950/60 opacity-75'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-3xl shadow-lg`}>
                        {cat.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-lg">{cat.name}</h4>
                        <p className="text-slate-400 text-xs mt-1">ลำดับ: {cat.sortOrder}</p>
                      </div>
                    </div>
                    <div>
                      {cat.isActive ? (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full font-semibold flex items-center space-x-1">
                          <CheckCircle2 size={12} /><span>ใช้งานอยู่</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded-full font-semibold flex items-center space-x-1">
                          <Ban size={12} /><span>ปิดการขาย</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="my-5 border-t border-slate-800/80"></div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleCatStatus(cat.id, cat.isActive)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1 cursor-pointer ${cat.isActive ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'}`}
                    >
                      <Ban size={14} />
                      <span>{cat.isActive ? 'บล็อกการขาย' : 'เปิดใช้งาน'}</span>
                    </button>
                    <button onClick={() => handleOpenEditCat(cat)} className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition cursor-pointer" title="แก้ไข">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => setDeleteModal({ isOpen: true, type: 'category', id: cat.id, name: cat.name })} className="p-2 bg-slate-800 hover:bg-red-950/60 text-red-400 rounded-xl transition cursor-pointer" title="ลบ">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: สต็อกคงเหลือ & รับเข้า-ปรับปรุง (พร้อมระบบ Filter และ Sorting ทุกคอลัมน์) --- */}
      {activeTab === 'stocks' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <h3 className="font-bold text-slate-200 flex items-center space-x-2">
                <Package size={18} className="text-amber-400" />
                <span>สต็อกสินค้าคงเหลือ ({sortedStocks.length})</span>
              </h3>
              <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${stockFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setStockFilter('low_stock')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${stockFilter === 'low_stock' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  ⚠️ ใกล้หมด / ต้องเติม
                </button>
              </div>
            </div>

            <div className="relative w-full md:w-72">
              <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้าในสต็อก..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 text-xs border-b border-slate-800 uppercase tracking-wider select-none">
                  <th onClick={() => handleStockSort('name')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center space-x-1">
                      <span>ชื่อสินค้า</span>
                      {stockSortField === 'name' ? (stockSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleStockSort('category')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center space-x-1">
                      <span>หมวดหมู่</span>
                      {stockSortField === 'category' ? (stockSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleStockSort('currentQty')} className="p-4 text-center cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center justify-center space-x-1">
                      <span>คงเหลือ (CURRENT QTY)</span>
                      {stockSortField === 'currentQty' ? (stockSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleStockSort('minimumQty')} className="p-4 text-center cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center justify-center space-x-1 text-amber-400">
                      <span>จุดเตือนขั้นต่ำ (MIN QTY)</span>
                      {stockSortField === 'minimumQty' ? (stockSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleStockSort('status')} className="p-4 text-center cursor-pointer hover:text-amber-400 transition">
                    <div className="flex items-center justify-center space-x-1">
                      <span>สถานะสต็อก</span>
                      {stockSortField === 'status' ? (stockSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-40" />}
                    </div>
                  </th>
                  <th className="p-4 text-center">ดำเนินการด่วน (STOCK ACTION)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {loadingStocks ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 size={20} className="animate-spin text-amber-500" />
                        <span>กำลังโหลดข้อมูลสต็อก...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      ไม่พบรายการสินค้า
                    </td>
                  </tr>
                ) : (
                  sortedStocks.map((prod) => {
                    const cat = categories.find(c => c.id === prod.categoryId)
                    const st = stocks.find(s => s.productId === prod.id)
                    const qty = st ? st.currentQty : 0
                    const minQty = st ? st.minimumQty : 5
                    const isOut = qty === 0
                    const isLow = qty <= minQty

                    return (
                      <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-semibold text-slate-100">{prod.name}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-xs rounded-lg text-slate-300">
                            {cat ? `${cat.icon} ${cat.name}` : 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-mono font-bold text-lg ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {qty.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number"
                            value={minQty}
                            onChange={(e) => handleUpdateMinimumQty(prod.id, Number(e.target.value) || 0)}
                            className="w-20 mx-auto bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500 text-sm"
                            min={0}
                          />
                        </td>
                        <td className="p-4 text-center">
                          {isOut ? (
                            <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded-full font-medium">
                              สินค้าหมด (Out of Stock)
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs rounded-full font-medium">
                              ใกล้หมด (Low Stock)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-full font-medium">
                              ปกติ (In Stock)
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleOpenStockModal(prod, 'in')}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow flex items-center space-x-1 text-xs cursor-pointer"
                              title="รับสินค้าเข้า"
                            >
                              <PackagePlus size={15} />
                              <span>รับเข้า</span>
                            </button>
                            <button
                              onClick={() => handleOpenStockModal(prod, 'adjust')}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-semibold rounded-xl transition flex items-center space-x-1 text-xs cursor-pointer"
                              title="ปรับยอดสต็อกตรง"
                            >
                              <SlidersHorizontal size={15} />
                              <span>ปรับยอด</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL: ยืนยันการลบ --- */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">ยืนยันการลบข้อมูล</h3>
              <p className="text-slate-400 text-sm mt-1">
                คุณต้องการลบ <span className="text-amber-400 font-semibold">"{deleteModal.name}"</span> นี้ใช่หรือไม่?
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button type="button" onClick={() => setDeleteModal({ isOpen: false, type: null, id: null, name: '' })} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition cursor-pointer">
                ยกเลิก
              </button>
              <button type="button" onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg cursor-pointer">
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: เพิ่ม/แก้ไข สินค้า --- */}
      {openProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">{editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
              <button onClick={() => setOpenProductModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">ชื่อสินค้า:</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="เช่น Regal 700ml"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">หมวดหมู่สินค้า:</label>
                <select
                  value={prodCategoryId}
                  onChange={(e) => setProdCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">ราคาปกติ (บาท):</label>
                  <input
                    type="number"
                    value={prodNormalPrice}
                    onChange={(e) => setProdNormalPrice(e.target.value)}
                    placeholder="450"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">ราคา Tournament ⭐:</label>
                  <input
                    type="number"
                    value={prodTournamentPrice}
                    onChange={(e) => setProdTournamentPrice(e.target.value)}
                    placeholder="390"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-amber-400 focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setOpenProductModal(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition cursor-pointer">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg cursor-pointer">
                  บันทึกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: เพิ่ม/แก้ไข หมวดหมู่ --- */}
      {openCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">{editingCat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h3>
              <button onClick={() => setOpenCatModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">เลือกไอคอน (Emoji):</label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    className="w-16 h-12 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl text-white focus:outline-none focus:border-amber-500"
                    maxLength={2}
                    required
                  />
                  <span className="text-xs text-slate-400">เลือกจากด้านล่าง หรือพิมพ์ Emoji</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {PRESET_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCatIcon(emoji)}
                      className={`h-9 rounded-lg text-xl flex items-center justify-center transition cursor-pointer ${catIcon === emoji ? 'bg-amber-500 text-slate-950 shadow scale-105' : 'hover:bg-slate-800 text-slate-300'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">ชื่อหมวดหมู่:</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="เช่น มิกเซอร์, ของทานเล่น"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                  required
                  autoFocus
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setOpenCatModal(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition cursor-pointer">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg cursor-pointer">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: รับสินค้าเข้า & ปรับยอดสต็อกด่วนสำหรับแคชเชียร์ --- */}
      {stockModal.isOpen && stockModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                {stockModal.mode === 'in' ? <PackagePlus className="text-amber-400" size={20} /> : <SlidersHorizontal className="text-amber-400" size={20} />}
                <span>{stockModal.mode === 'in' ? 'รับสินค้าเข้าสต็อก' : 'ปรับปรุงยอดสต็อก'}</span>
              </h3>
              <button onClick={() => setStockModal({ isOpen: false, mode: null, product: null })} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
              <p className="text-xs text-slate-400">สินค้า:</p>
              <p className="font-bold text-slate-100 text-base">{stockModal.product.name}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2">
                <span>ยอดคงเหลือปัจจุบัน:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {stocks.find(s => s.productId === stockModal.product.id)?.currentQty || 0} หน่วย
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {stockModal.mode === 'in' ? 'จำนวนที่รับเข้าเพิ่ม (+):' : 'ยอดสต็อกจริงที่นับได้ใหม่:'}
                </label>
                <input
                  type="number"
                  value={stockInputQty}
                  onChange={(e) => setStockInputQty(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-amber-400 focus:outline-none focus:border-amber-500 font-mono font-bold text-lg"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">หมายเหตุ:</label>
                <input
                  type="text"
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="เช่น รับของจากเซลล์, ตรวจนับสต็อกประจำวัน"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setStockModal({ isOpen: false, mode: null, product: null })} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition cursor-pointer">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg cursor-pointer">
                  ยืนยันบันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}