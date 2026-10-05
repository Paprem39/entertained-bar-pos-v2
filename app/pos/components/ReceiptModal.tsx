'use client';

import React from 'react';

interface BillItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierName: string;
  billNo: string;
  customerName: string;
  openTime: string;
  checkoutTime: string;
  items: BillItem[];
  totalQuantity: number;
  totalAmount: number;
  paymentMethod: string;
  cashReceived: string;
  changeAmount: number;
  transferNote: string;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  cashierName,
  billNo,
  customerName,
  openTime,
  checkoutTime,
  items,
  totalQuantity,
  totalAmount,
  paymentMethod,
  cashReceived,
  changeAmount,
  transferNote,
}: ReceiptModalProps) {
  if (!isOpen) return null;

  const cashNum = parseFloat(cashReceived) || 0;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl flex flex-col shadow-2xl overflow-hidden p-8 space-y-5 font-mono max-h-[90vh] overflow-y-auto">
        
        {/* Header: ชื่อร้าน Entertained bar */}
        <div className="text-center border-b border-dashed border-slate-300 pb-4 space-y-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-wider">Entertained bar</h2>
          <p className="text-xs text-slate-600">ซ.94 หัวหิน ประจวบคีรีขันธ์ 77110</p>
          <p className="text-xs text-slate-600">โทร: 092-952-2625</p>
          <h3 className="text-xs font-bold text-slate-800 mt-2 uppercase tracking-wider">--- ใบแจ้งยอด / ใบเสร็จ ---</h3>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="bg-blue-900 text-white font-bold text-[10px] px-3 py-1 rounded-t-lg tracking-wider mb-2">
            THAI QR PAYMENT | PromptPay
          </div>
          <div className="w-36 h-36 bg-white p-2 border border-slate-300 rounded-xl flex items-center justify-center shadow-inner">
            <img 
              src="/Qr.png" 
              alt="QR PromptPay" 
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[11px] text-slate-600 mt-2">สแกน QR เพื่อโอนเข้าบัญชี</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">ชื่อ: น.ส. สรสวรรค์ บุญไสว</p>
          <p className="text-[11px] text-slate-500 font-mono">บัญชี: xxx-x-x2535-x</p>
        </div>

        {/* ข้อมูลบิล */}
        <div className="text-xs space-y-1.5 text-slate-700 border-b border-dashed border-slate-300 pb-4">
          <div className="flex justify-between">
            <span>พนักงาน:</span>
            <strong className="text-slate-900">{cashierName}</strong>
          </div>
          <div className="flex justify-between">
            <span>เลขที่บิล:</span>
            <strong className="text-slate-900">{billNo}</strong>
          </div>
          <div className="flex justify-between">
            <span>ชื่อลูกค้า:</span>
            <strong className="text-slate-900">{customerName}</strong>
          </div>
          <div className="flex justify-between">
            <span>เวลาเปิดบิล:</span>
            <span>{openTime}</span>
          </div>
          <div className="flex justify-between">
            <span>เวลาพิมพ์:</span>
            <span>{checkoutTime}</span>
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between font-bold text-slate-500 border-b pb-1">
            <span>รายการ</span>
            <span>จำนวน / ราคา</span>
          </div>
          {items.map((it) => (
            <div key={it.id} className="flex justify-between items-center">
              <span className="truncate w-48">{it.name} x{it.quantity}</span>
              <span className="font-bold">฿{it.price * it.quantity}</span>
            </div>
          ))}
        </div>

        {/* ยอดรวม */}
        <div className="border-t border-dashed border-slate-300 pt-4 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600 font-semibold">
            <span>ยอดรวมจำนวน (QTY):</span>
            <span>{totalQuantity} ชิ้น</span>
          </div>
          <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
            <span>ยอดรวมสุทธิ:</span>
            <span>฿{totalAmount.toLocaleString()}</span>
          </div>
          {paymentMethod === 'cash' && cashNum > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>รับเงินสดมา:</span>
                <span>฿{cashNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>เงินทอน:</span>
                <span>฿{changeAmount.toLocaleString()}</span>
              </div>
            </>
          )}
          {paymentMethod === 'transfer' && transferNote && (
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>หมายเหตุโอน:</span>
              <strong className="text-amber-700">{transferNote}</strong>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-600 pt-2 border-t border-dashed border-slate-300 space-y-1">
          <p className="font-bold">ขอบคุณที่ใช้บริการค่ะ</p>
          <p className="text-[10px]">Please come again!</p>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow"
          >
            🖨️ ปริ้น
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow"
          >
            ✓ ปิดหน้าต่างนี้
          </button>
        </div>

      </div>
    </div>
  );
}