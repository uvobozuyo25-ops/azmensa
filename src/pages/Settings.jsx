import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Database } from 'lucide-react';
import '../components/Management.css';

const VPS_SYNC_URL = import.meta.env.VITE_VPS_SYNC_URL || 'https://al-azharplatform.duckdns.org/api/sync-from-atlas';
const VPS_SYNC_SECRET = import.meta.env.VITE_VPS_SYNC_SECRET || 'azhar-vps-sync-2026';

function Settings() {
  const [isLinkOpen, setIsLinkOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSyncingToVps, setIsSyncingToVps] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const applicationLink = 'https://alazhar.epream.net/offline-application';

  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}'); }
    catch { return {}; }
  })();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'admin';

  const handleCopy = () => {
    navigator.clipboard.writeText(applicationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncToVps = async () => {
    if (!isAdmin || isSyncingToVps) return;
    const confirmed = window.confirm(
      'تحذير: سيتم نسخ جميع البيانات الحالية من قاعدة بيانات فيرسيل (MongoDB Atlas) واستبدال البيانات الموجودة على سيرفر الـ VPS بها.\n\nهل تريد المتابعة؟'
    );
    if (!confirmed) return;

    setIsSyncingToVps(true);
    setSyncResult(null);
    try {
      const response = await fetch(VPS_SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Secret': VPS_SYNC_SECRET,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `فشل الترحيل (HTTP ${response.status})`);
      }
      setSyncResult({
        ok: true,
        message: `تم ترحيل ${data.totalRestored || 0} سجل إلى سيرفر الـ VPS بنجاح.`,
      });
    } catch (err) {
      setSyncResult({
        ok: false,
        message: err.message || 'تعذر الاتصال بسيرفر الـ VPS أثناء الترحيل.',
      });
    } finally {
      setIsSyncingToVps(false);
    }
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px' }}>إعدادات طلبات الالتحاق</h2>
      </div>

      <div className="box-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '30px' }}>
        <h3 style={{ marginBottom: '30px', color: 'var(--text-primary)', fontSize: '18px', display: 'flex', justifyContent: 'flex-start' }}>
          إعدادات رابط التقديم (للزوار)
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', width: '120px', textAlign: 'right' }}>رابط التقديم</label>
            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                className="form-input" 
                value={applicationLink} 
                readOnly 
                style={{ direction: 'ltr', paddingLeft: '45px', background: 'rgba(255,255,255,0.02)', borderColor: 'var(--accent-gold)' }}
              />
              <button 
                onClick={handleCopy}
                style={{ 
                  position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: copied ? '#22c55e' : 'var(--text-muted)',
                  cursor: 'pointer', padding: '5px'
                }}
                title="نسخ الرابط"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', width: '120px', textAlign: 'right' }}>حالة رابط التقديم</label>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: isLinkOpen ? '#22c55e' : 'var(--text-muted)', fontWeight: 'bold' }}>
                  {isLinkOpen ? 'مفتوح' : 'مغلق'}
                </span>
                
                {/* Toggle Switch */}
                <div 
                  onClick={() => setIsLinkOpen(!isLinkOpen)}
                  style={{ 
                    width: '50px', height: '26px', borderRadius: '13px', 
                    background: isLinkOpen ? '#22c55e' : 'var(--bg-lighter)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '3px', transition: 'all 0.3s',
                    left: isLinkOpen ? '27px' : '3px'
                  }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {isAdmin && (
        <div className="box-card" style={{ maxWidth: '600px', margin: '24px auto 0', padding: '30px' }}>
          <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} style={{ color: 'var(--accent-gold)' }} />
            ترحيل البيانات إلى سيرفر الـ VPS
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.7 }}>
            سحب أحدث نسخة من جميع البيانات على فيرسيل (المتقدمين، المستخدمين، المجموعات، الكوادر، والتقارير) ونقلها إلى سيرفر Hetzner VPS (al-azharplatform.duckdns.org).
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSyncToVps}
            disabled={isSyncingToVps}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={isSyncingToVps ? 'spin' : ''} />
            {isSyncingToVps ? 'جارٍ ترحيل البيانات إلى الـ VPS...' : 'ترحيل البيانات إلى الـ VPS الآن'}
          </button>

          {syncResult && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                background: syncResult.ok ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${syncResult.ok ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                color: syncResult.ok ? '#22c55e' : '#ef4444',
              }}
            >
              {syncResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Settings;
