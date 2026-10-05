'use client';

import React from 'react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  totalAmount: number;
  paymentMethod: 'cash' | 'transfer' | 'credit';
  setPaymentMethod: (method: 'cash' | 'transfer' | 'credit') => void;
  cashReceived: string;
  setCashReceived: (val: string) => void;
  changeAmount: number;
  transferNote: string;
  setTransferNote: (val: string) => void;
  onPrintPreview: () => void;
  onConfirmCheckout: () => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  blockId,
  totalAmount,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  changeAmount,
  transferNote,
  setTransferNote,
  onPrintPreview,
  onConfirmCheckout,
}: CheckoutModalProps) {
  if (!isOpen) return null;

  const cashNum = parseFloat(cashReceived) || 0;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        
        <div className="px-8 py-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-amber-400">💳 ชำระเงิน / คิดเงิน (Block {blockId})</h3>
            <p className="text-xs text-slate-400 mt-0.5">เลือกช่องทางการชำระเงินและสรุปบิล</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-bold flex items-center justify-center cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-300 font-bold">ยอดชำระสุทธิทั้งสิ้น:</span>
            <span className="text-3xl font-black text-amber-400">฿{totalAmount.toLocaleString()}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-2 block">เลือกช่องทางการชำระเงิน:</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                  paymentMethod === 'cash'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                💵 เงินสด
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                  paymentMethod === 'transfer'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                📱 โอนจ่าย
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                  paymentMethod === 'credit'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                📝 เครดิต (ค้างชำระ)
              </button>
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block">รับเงินสดมา (บาท):</label>
                <input
                  type="number"
                  placeholder="ระบุจำนวนเงินสด..."
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-lg font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashReceived(amt.toString())}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
                  >
                    +{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCashReceived(totalAmount.toString())}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/40 transition cursor-pointer"
                >
                  พอดี (฿{totalAmount})
                </button>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                <span className="text-slate-400 font-bold">เงินทอน:</span>
                <span className={`text-2xl font-black ${changeAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ฿{changeAmount >= 0 ? changeAmount.toLocaleString() : 'เงินไม่พอ'}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'transfer' && (
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-slate-400 block">
                หมายเหตุ / Note (เช่น กรณีโอนเกินมา 20 บาท):
              </label>
              <input
                type="text"
                placeholder="กรอกหมายเหตุ หรือปล่อยว่างไว้ก็ได้..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {paymentMethod === 'credit' && (
            <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 text-amber-300 text-xs font-medium leading-relaxed">
              📝 โหมดเครดิตค้างชำระ: สต็อกสินค้าถูกตัดเรียบร้อยแล้ว เมื่อกดยืนยัน ระบบจะบันทึกและย้ายบิลนี้ไปไว้ที่หน้าเครดิตค้างชำระ
            </div>
          )}
        </div>

        <div className="px-8 py-5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <button
            type="button"
            onClick={onPrintPreview}
            className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-2xl text-xs transition cursor-pointer border border-slate-700 flex items-center space-x-2 shadow"
          >
            <span>🖨️</span>
            <span>พิมพ์ใบแจ้งยอด</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onConfirmCheckout}
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-sm transition cursor-pointer shadow-xl"
            >
              {paymentMethod === 'credit' ? '✓ บันทึกเครดิตค้างชำระ' : '✓ ยืนยันการชำระเงิน'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}