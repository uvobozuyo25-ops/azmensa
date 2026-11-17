import React, { useState, useMemo } from 'react';
import { Clock, Calendar, Printer, Download, Plus, Edit, Trash2, Check, Users, FileText } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { normalizeArabic } from '../utils/userScopeHelper';
import { formatTime12Ar, normalizeExamDate, normalizeExamTime } from '../utils/placementHelpers';
import { exportToXLSX } from '../utils/xlsxHelper';
import '../components/Management.css';

const ROLE_LABELS = {
  scientific_supervisor: 'مشرف علمي',
  technical_supervisor: 'مشرف تقني',
  coordinator: 'منسق',
  mohfez: 'محفظ',
};

const calcDurationHours = (fromTime, toTime) => {
  if (!fromTime || !toTime) return 0;
  const [fh, fm] = String(fromTime).split(':').map(Number);
  const [th, tm] = String(toTime).split(':').map(Number);
  if ([fh, fm, th, tm].some(Number.isNaN)) return 0;
  let diffMins = (th * 60 + tm) - (fh * 60 + fm);
  if (diffMins < 0) diffMins += 24 * 60;
  return Math.round((diffMins / 60) * 100) / 100;
};

const formatDurationAr = (hours) => {
  const totalMins = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0 && m === 0) return '0 دقيقة';
  if (m === 0) return `${h} ساعة`;
  if (h === 0) return `${m} دقيقة`;
  return `${h} ساعة و ${m} دقيقة`;
};

const formatNum = (n) => {
  const val = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
};

function PlacementWorkLogs() {
  const {
    placementGroups,
    placementApplicants,
    placementWorkLogs,
    addPlacementWorkLog,
    updatePlacementWorkLog,
    deletePlacementWorkLog,
    platformMohfezs,
    platformCoordinators,
    platformSupervisors,
    mohfezs,
    coordinators,
    users,
  } = useAppData();

  const currentUser = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}'); }
    catch { return {}; }
  }, []);

  const role = currentUser?.role || '';
  const isAdmin = role === 'admin' || role === 'platform_admin';
  const myNormName = normalizeArabic(currentUser?.name || '');

  // المجموعات المتاحة للمستخدم الحالي
  const accessibleGroups = useMemo(() => {
    if (isAdmin) return placementGroups;
    if (!myNormName) return [];
    const matched = placementGroups.filter(g => {
      const sci = normalizeArabic(g.scientific_supervisor || '');
      const tech = normalizeArabic(g.technical_supervisor || '');
      const coord = normalizeArabic(g.coordinator || '');
      const moh = normalizeArabic(g.mohfez || '');
      return (sci && sci === myNormName) ||
             (tech && tech === myNormName) ||
             (coord && coord === myNormName) ||
             (moh && moh === myNormName);
    });
    return matched.length > 0 ? matched : (role === 'platform_supervisor' ? placementGroups : []);
  }, [placementGroups, isAdmin, myNormName, role]);

  const accessibleGroupSet = useMemo(
    () => new Set(accessibleGroups.map(g => Number(g.group_no))),
    [accessibleGroups]
  );

  // تواريخ الاختبار المسجلة كخيارات سريعة
  const quickExamDates = useMemo(() => {
    const counts = new Map();
    platformApplicants.forEach(a => {
      if (!isAdmin && !accessibleGroupSet.has(Number(a.group_no))) return;
      const d = normalizeExamDate(a.exam_date);
      if (d) counts.set(d, (counts.get(d) || 0) + 1);
    });
    return Array.from(counts.keys()).sort();
  }, [platformApplicants, isAdmin, accessibleGroupSet]);

  // قوائم الكوادر للاختيار
  const scientificSupervisorOptions = useMemo(() => {
    const names = new Set();
    platformMohfezs.forEach(m => m.name && names.add(m.name.trim()));
    platformSupervisors.forEach(s => s.name && names.add(s.name.trim()));
    placementGroups.forEach(g => g.scientific_supervisor && names.add(g.scientific_supervisor.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [platformMohfezs, platformSupervisors, placementGroups]);

  const technicalSupervisorOptions = useMemo(() => {
    const names = new Set();
    platformCoordinators.forEach(c => c.name && names.add(c.name.trim()));
    platformSupervisors.forEach(s => s.name && names.add(s.name.trim()));
    placementGroups.forEach(g => g.technical_supervisor && names.add(g.technical_supervisor.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [platformCoordinators, platformSupervisors, placementGroups]);

  const mohfezOptions = useMemo(() => {
    const names = new Set();
    platformMohfezs.forEach(m => m.name && names.add(m.name.trim()));
    placementGroups.forEach(g => g.mohfez && names.add(g.mohfez.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [platformMohfezs, placementGroups]);

  const coordinatorOptions = useMemo(() => {
    const names = new Set();
    platformCoordinators.forEach(c => c.name && names.add(c.name.trim()));
    placementGroups.forEach(g => g.coordinator && names.add(g.coordinator.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [platformCoordinators, placementGroups]);

  // خريطة البحث عن الرقم القومي ورقم السجل بالاسم
  const staffMetaMap = useMemo(() => {
    const map = new Map();
    const register = (item) => {
      if (!item?.name) return;
      const key = normalizeArabic(item.name);
      if (!key) return;
      const nid = String(item.national_id || item.passport_no || '').trim();
      const reg = String(item.registry_no || item.record_no || item.record_number || '').trim();
      const prev = map.get(key) || { national_id: '', registry_no: '' };
      map.set(key, {
        national_id: prev.national_id || (nid !== 'admin' ? nid : ''),
        registry_no: prev.registry_no || (reg !== 'admin' ? reg : ''),
      });
    };
    [
      ...platformMohfezs,
      ...platformCoordinators,
      ...platformSupervisors,
      ...mohfezs,
      ...coordinators,
      ...users,
    ].forEach(register);
    return map;
  }, [platformMohfezs, platformCoordinators, platformSupervisors, mohfezs, coordinators, users]);

  const getStaffMeta = (name) => {
    if (!name) return { national_id: '', registry_no: '' };
    return staffMetaMap.get(normalizeArabic(name)) || { national_id: '', registry_no: '' };
  };

  // حالة التبويب والنماذج
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' | 'report'
  const [editingLogId, setEditingLogId] = useState(null);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedGroupNo, setSelectedGroupNo] = useState('');
  const [scientificSupervisor, setScientificSupervisor] = useState('');
  const [technicalSupervisor, setTechnicalSupervisor] = useState('');
  const [mohfezName, setMohfezName] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [includeScientific, setIncludeScientific] = useState(true);
  const [includeTechnical, setIncludeTechnical] = useState(true);
  const [includeMohfez, setIncludeMohfez] = useState(true);
  const [includeCoordinator, setIncludeCoordinator] = useState(true);
  const [timeFrom, setTimeFrom] = useState('17:30');
  const [timeTo, setTimeTo] = useState('21:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // فلاتر كشف الطباعة والتصدير
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterGroupNo, setFilterGroupNo] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [reportViewMode, setReportViewMode] = useState('summary'); // 'summary' | 'detailed'

  const handleSelectGroup = (gNoStr) => {
    setSelectedGroupNo(gNoStr);
    const grp = placementGroups.find(g => Number(g.group_no) === Number(gNoStr));
    if (grp) {
      setScientificSupervisor(grp.scientific_supervisor || '');
      setTechnicalSupervisor(grp.technical_supervisor || '');
      setMohfezName(grp.mohfez || '');
      setCoordinatorName(grp.coordinator || '');
      setTimeFrom(normalizeExamTime(grp.time_start) || '17:30');
      setTimeTo(normalizeExamTime(grp.time_end) || '21:00');
      setIncludeScientific(Boolean(grp.scientific_supervisor));
      setIncludeTechnical(Boolean(grp.technical_supervisor));
      setIncludeMohfez(Boolean(grp.mohfez));
      setIncludeCoordinator(Boolean(grp.coordinator));
    }
  };

  const durationHours = useMemo(() => calcDurationHours(timeFrom, timeTo), [timeFrom, timeTo]);

  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!workDate) {
      alert('يرجى اختيار اليوم');
      return;
    }
    if (!selectedGroupNo) {
      alert('يرجى اختيار المجموعة');
      return;
    }
    if (durationHours <= 0) {
      alert('يرجى تحديد وقت عمل صحيح (من - إلى)');
      return;
    }
    const payload = {
      work_date: normalizeExamDate(workDate) || workDate,
      group_no: Number(selectedGroupNo),
      scientific_supervisor: includeScientific ? scientificSupervisor.trim() : '',
      technical_supervisor: includeTechnical ? technicalSupervisor.trim() : '',
      mohfez: includeMohfez ? mohfezName.trim() : '',
      coordinator: includeCoordinator ? coordinatorName.trim() : '',
      time_from: timeFrom,
      time_to: timeTo,
      hours: durationHours,
      notes: notes.trim(),
      recorded_by: currentUser?.name || currentUser?.username || '',
    };

    if (!payload.scientific_supervisor && !payload.technical_supervisor && !payload.mohfez && !payload.coordinator) {
      alert('يرجى اختيار فرد واحد على الأقل (مشرف علمي / مشرف تقني / محفظ / منسق)');
      return;
    }

    setSaving(true);
    try {
      if (editingLogId) {
        await updatePlacementWorkLog(editingLogId, payload);
        setEditingLogId(null);
        alert('✅ تم تحديث سجل العمل بنجاح');
      } else {
        await addPlacementWorkLog(payload);
        alert('✅ تم حفظ سجل العمل بنجاح');
      }
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleEditLog = (log) => {
    setEditingLogId(log.id || log._id);
    setWorkDate(normalizeExamDate(log.work_date) || '');
    setSelectedGroupNo(String(log.group_no || ''));
    setScientificSupervisor(log.scientific_supervisor || '');
    setTechnicalSupervisor(log.technical_supervisor || '');
    setMohfezName(log.mohfez || '');
    setCoordinatorName(log.coordinator || '');
    setIncludeScientific(Boolean(log.scientific_supervisor));
    setIncludeTechnical(Boolean(log.technical_supervisor));
    setIncludeMohfez(Boolean(log.mohfez));
    setIncludeCoordinator(Boolean(log.coordinator));
    setTimeFrom(log.time_from || '17:30');
    setTimeTo(log.time_to || '21:00');
    setNotes(log.notes || '');
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLog = async (log) => {
    if (!window.confirm(`هل أنت متأكد من حذف سجل يوم ${log.work_date} لمجموعة ${log.group_no}؟`)) return;
    await deletePlacementWorkLog(log.id || log._id);
  };

  // السجلات المصرح بعرضها
  const scopedLogs = useMemo(() => {
    const list = Array.isArray(placementWorkLogs) ? placementWorkLogs : [];
    const filteredByScope = isAdmin
      ? list
      : list.filter(l => accessibleGroupSet.has(Number(l.group_no)));
    return [...filteredByScope].sort((a, b) => {
      const dCmp = String(b.work_date || '').localeCompare(String(a.work_date || ''));
      if (dCmp !== 0) return dCmp;
      return Number(a.group_no || 0) - Number(b.group_no || 0);
    });
  }, [placementWorkLogs, isAdmin, accessibleGroupSet]);

  // تحويل السجلات إلى صفوف تفصيلية حسب الفلاتر
  const detailedEntries = useMemo(() => {
    const rows = [];
    const normSearch = normalizeArabic(searchText);
    scopedLogs.forEach(log => {
      const d = normalizeExamDate(log.work_date) || log.work_date || '';
      if (filterDateFrom && d < filterDateFrom) return;
      if (filterDateTo && d > filterDateTo) return;
      if (filterGroupNo && Number(log.group_no) !== Number(filterGroupNo)) return;

      const hrs = Number(log.hours || calcDurationHours(log.time_from, log.time_to));
      const participants = [
        { roleKey: 'scientific_supervisor', name: log.scientific_supervisor },
        { roleKey: 'technical_supervisor', name: log.technical_supervisor },
        { roleKey: 'coordinator', name: log.coordinator },
        { roleKey: 'mohfez', name: log.mohfez },
      ];

      participants.forEach(({ roleKey, name }) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) return;
        if (filterRole !== 'ALL' && filterRole !== roleKey) return;
        if (normSearch) {
          const meta = getStaffMeta(cleanName);
          const matchName = normalizeArabic(cleanName).includes(normSearch);
          const matchNid = meta.national_id.includes(searchText.trim());
          const matchReg = meta.registry_no.includes(searchText.trim());
          if (!matchName && !matchNid && !matchReg) return;
        }
        const meta = getStaffMeta(cleanName);
        const days = roleKey === 'mohfez' ? null : Math.round((hrs / 3) * 100) / 100;
        rows.push({
          logId: log.id || log._id,
          work_date: d,
          group_no: log.group_no,
          roleKey,
          roleLabel: ROLE_LABELS[roleKey],
          name: cleanName,
          national_id: meta.national_id,
          registry_no: meta.registry_no,
          time_from: log.time_from || '',
          time_to: log.time_to || '',
          hours: hrs,
          days,
        });
      });
    });
    return rows;
  }, [scopedLogs, filterDateFrom, filterDateTo, filterGroupNo, filterRole, searchText, staffMetaMap]);

  // تجميع إجمالي لكل شخص (مع منع تكرار نفس الوقت لنفس الشخص في عدة مجموعات متزامنة)
  const summaryRows = useMemo(() => {
    const map = new Map();
    detailedEntries.forEach(entry => {
      const personKey = `${entry.roleKey}__${normalizeArabic(entry.name)}`;
      if (!map.has(personKey)) {
        map.set(personKey, {
          roleKey: entry.roleKey,
          roleLabel: entry.roleLabel,
          name: entry.name,
          national_id: entry.national_id,
          registry_no: entry.registry_no,
          groups: new Set(),
          dates: new Set(),
          slotHours: new Map(), // key: date|from|to -> max hours (لا يُحتسب نفس التوقيت مرتين في يوم واحد)
        });
      }
      const rec = map.get(personKey);
      rec.groups.add(entry.group_no);
      rec.dates.add(entry.work_date);
      const slotKey = `${entry.work_date}|${entry.time_from}|${entry.time_to}`;
      const prevH = rec.slotHours.get(slotKey) || 0;
      if (entry.hours > prevH) rec.slotHours.set(slotKey, entry.hours);
    });

    return Array.from(map.values())
      .map(rec => {
        let totalHours = 0;
        rec.slotHours.forEach(h => { totalHours += h; });
        totalHours = Math.round(totalHours * 100) / 100;
        const isMohfez = rec.roleKey === 'mohfez';
        const calcDays = isMohfez ? null : Math.round((totalHours / 3) * 100) / 100;
        return {
          roleKey: rec.roleKey,
          roleLabel: rec.roleLabel,
          name: rec.name,
          national_id: rec.national_id,
          registry_no: rec.registry_no,
          groupsCount: rec.groups.size,
          groupsList: Array.from(rec.groups).sort((a, b) => Number(a) - Number(b)).join('، '),
          daysWorkedCount: rec.dates.size,
          totalHours,
          calcDays,
          entitlementText: isMohfez
            ? `${formatNum(totalHours)} ساعة`
            : `${formatNum(calcDays)} يوم (${formatNum(totalHours)} س ÷ 3)`,
        };
      })
      .sort((a, b) => a.roleLabel.localeCompare(b.roleLabel, 'ar') || a.name.localeCompare(b.name, 'ar'));
  }, [detailedEntries]);

  const handleExportExcel = () => {
    if (reportViewMode === 'summary') {
      if (summaryRows.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      const rows = summaryRows.map((r, idx) => ({
        'م': idx + 1,
        'الاسم': r.name,
        'الصفة': r.roleLabel,
        'الرقم القومي': r.national_id || '',
        'رقم السجل': r.registry_no || '',
        'المجموعات': r.groupsList,
        'عدد أيام التواجد': r.daysWorkedCount,
        'إجمالي الساعات': r.totalHours,
        'الأيام المحسوبة (كل 3 ساعات بيوم)': r.calcDays !== null ? r.calcDays : '',
        'صافي المستحق': r.entitlementText,
      }));
      exportToXLSX(rows, 'حصر_عمل_تحديد_المستوى_إجمالي', 'حصر العمل الإجمالي');
    } else {
      if (detailedEntries.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      const rows = detailedEntries.map((r, idx) => ({
        'م': idx + 1,
        'التاريخ': r.work_date,
        'رقم المجموعة': r.group_no,
        'الاسم': r.name,
        'الصفة': r.roleLabel,
        'الرقم القومي': r.national_id || '',
        'رقم السجل': r.registry_no || '',
        'من': formatTime12Ar(r.time_from) || r.time_from,
        'إلى': formatTime12Ar(r.time_to) || r.time_to,
        'الساعات': r.hours,
        'المستحق': r.roleKey === 'mohfez' ? `${formatNum(r.hours)} ساعة` : `${formatNum(r.days)} يوم`,
      }));
      exportToXLSX(rows, 'حصر_عمل_تحديد_المستوى_تفصيلي', 'حصر العمل التفصيلي');
    }
  };

  const handlePrintPDF = () => {
    const isSummary = reportViewMode === 'summary';
    const data = isSummary ? summaryRows : detailedEntries;
    if (data.length === 0) {
      alert('لا توجد بيانات للطباعة');
      return;
    }

    const periodLabel = (filterDateFrom || filterDateTo)
      ? `الفترة: ${filterDateFrom || 'البداية'} إلى ${filterDateTo || 'الآن'}`
      : 'كافة الأيام المسجلة';

    const tableHeader = isSummary
      ? `<tr>
          <th>م</th>
          <th>الاسم</th>
          <th>الصفة</th>
          <th>الرقم القومي</th>
          <th>رقم السجل</th>
          <th>المجموعات</th>
          <th>أيام التواجد</th>
          <th>إجمالي الساعات</th>
          <th>صافي المستحق</th>
        </tr>`
      : `<tr>
          <th>م</th>
          <th>التاريخ</th>
          <th>المجموعة</th>
          <th>الاسم</th>
          <th>الصفة</th>
          <th>الرقم القومي</th>
          <th>رقم السجل</th>
          <th>من</th>
          <th>إلى</th>
          <th>الساعات</th>
          <th>المستحق</th>
        </tr>`;

    const tableRows = isSummary
      ? summaryRows.map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align:right;font-weight:bold;">${r.name}</td>
          <td>${r.roleLabel}</td>
          <td dir="ltr">${r.national_id || '-'}</td>
          <td dir="ltr">${r.registry_no || '-'}</td>
          <td>${r.groupsList}</td>
          <td>${r.daysWorkedCount}</td>
          <td>${formatNum(r.totalHours)}</td>
          <td style="font-weight:bold;">${r.entitlementText}</td>
        </tr>`).join('')
      : detailedEntries.map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td dir="ltr">${r.work_date}</td>
          <td>مجموعة ${r.group_no}</td>
          <td style="text-align:right;font-weight:bold;">${r.name}</td>
          <td>${r.roleLabel}</td>
          <td dir="ltr">${r.national_id || '-'}</td>
          <td dir="ltr">${r.registry_no || '-'}</td>
          <td>${formatTime12Ar(r.time_from) || r.time_from}</td>
          <td>${formatTime12Ar(r.time_to) || r.time_to}</td>
          <td>${formatNum(r.hours)}</td>
          <td style="font-weight:bold;">${r.roleKey === 'mohfez' ? `${formatNum(r.hours)} ساعة` : `${formatNum(r.days)} يوم`}</td>
        </tr>`).join('');

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>كشف حساب عمل تحديد المستوى - الرواق الأزهري</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; color: #111; margin: 0; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #0d4b3e; padding-bottom: 10px; margin-bottom: 14px; }
    .header h2 { margin: 0 0 4px; color: #0d4b3e; font-size: 20px; }
    .header p { margin: 2px 0; font-size: 13px; color: #333; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; color: #444; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #444; padding: 6px 8px; text-align: center; }
    th { background: #0d4b3e; color: #fff; font-weight: bold; }
    tr:nth-child(even) { background: #f8faf9; }
    .signatures { display: flex; justify-content: space-around; margin-top: 32px; font-size: 13px; font-weight: bold; }
    .sig-box { text-align: center; min-width: 180px; }
    .sig-line { margin-top: 30px; border-top: 1px dashed #666; padding-top: 4px; font-weight: normal; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>الجامع الأزهر الشريف — الرواق الأزهري (المنصة المحلية)</h2>
    <p><strong>كشف حساب عمل المشرفين والمنسقين والمحفظين في تحديد المستوى (${isSummary ? 'إجمالي' : 'تفصيلي'})</strong></p>
    <p>قاعدة الاحتساب: المحفظ (الساعة بساعة) — المشرف العلمي والمشرف التقني والمنسق (كل 3 ساعات = يوم عمل)</p>
  </div>
  <div class="meta">
    <span>${periodLabel}</span>
    <span>الصفة: ${filterRole === 'ALL' ? 'الجميع' : ROLE_LABELS[filterRole]}</span>
    <span>إجمالي السجلات: ${data.length}</span>
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
  </div>
  <table>
    <thead>${tableHeader}</thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="signatures">
    <div class="sig-box">المشرف التقني<div class="sig-line">التوقيع</div></div>
    <div class="sig-box">المشرف العلمي<div class="sig-line">التوقيع</div></div>
    <div class="sig-box">مدير الإدارة<div class="sig-line">الاعتماد</div></div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="management-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={24} style={{ color: 'var(--accent-gold)' }} />
            حساب عمل تحديد المستوى (المشرفين والمنسقين والمحفظين)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            المحفظ: الساعة بساعة &nbsp;|&nbsp; المشرف العلمي والمشرف التقني والمنسق: كل 3 ساعات بيوم عمل
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'entry' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('entry')}
          >
            <Plus size={16} /> تسجيل عمل اليوم
          </button>
          <button
            className={`btn ${activeTab === 'report' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('report')}
          >
            <FileText size={16} /> كشف الحصر والطباعة ({summaryRows.length})
          </button>
        </div>
      </div>

      {activeTab === 'entry' && (
        <>
          <form className="box-card" onSubmit={handleSaveLog} style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent-gold)' }}>
              {editingLogId ? 'تعديل سجل عمل مسجل' : 'تسجيل ساعات عمل يوم تحديد المستوى'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <div className="form-group">
                <label>1. اختيار اليوم *</label>
                <input
                  type="date"
                  className="form-input"
                  value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  required
                />
                {quickExamDates.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {quickExamDates.slice(0, 6).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setWorkDate(d)}
                        style={{
                          padding: '2px 7px',
                          fontSize: 11,
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: workDate === d ? 'var(--accent-gold)' : 'transparent',
                          color: workDate === d ? '#000' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>2. اختيار المجموعة *</label>
                <select
                  className="form-select"
                  value={selectedGroupNo}
                  onChange={e => handleSelectGroup(e.target.value)}
                  required
                >
                  <option value="">-- اختر المجموعة --</option>
                  {accessibleGroups.map(g => (
                    <option key={g.group_no} value={g.group_no}>
                      مجموعة {g.group_no} {g.mohfez ? `- ${g.mohfez}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>4. وقت العمل من *</label>
                <input
                  type="time"
                  className="form-input"
                  value={timeFrom}
                  onChange={e => setTimeFrom(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>وقت العمل إلى *</label>
                <input
                  type="time"
                  className="form-input"
                  value={timeTo}
                  onChange={e => setTimeTo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{
              margin: '14px 0',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 13,
            }}>
              <span>المدة المحسوبة: <strong>{formatDurationAr(durationHours)}</strong> ({formatNum(durationHours)} ساعة)</span>
              <span>للمحفظ: <strong>{formatNum(durationHours)} ساعة</strong></span>
              <span>للمشرف العلمي / التقني / المنسق: <strong>{formatNum(durationHours / 3)} يوم</strong></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 12 }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={includeScientific} onChange={e => setIncludeScientific(e.target.checked)} />
                  3. المشرف العلمي
                </label>
                <select
                  className="form-select"
                  value={scientificSupervisor}
                  onChange={e => { setScientificSupervisor(e.target.value); if (e.target.value) setIncludeScientific(true); }}
                  disabled={!includeScientific}
                >
                  <option value="">-- اختر المشرف العلمي --</option>
                  {scientificSupervisorOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={includeTechnical} onChange={e => setIncludeTechnical(e.target.checked)} />
                  المشرف التقني
                </label>
                <select
                  className="form-select"
                  value={technicalSupervisor}
                  onChange={e => { setTechnicalSupervisor(e.target.value); if (e.target.value) setIncludeTechnical(true); }}
                  disabled={!includeTechnical}
                >
                  <option value="">-- اختر المشرف التقني --</option>
                  {technicalSupervisorOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={includeMohfez} onChange={e => setIncludeMohfez(e.target.checked)} />
                  المحفظ
                </label>
                <select
                  className="form-select"
                  value={mohfezName}
                  onChange={e => { setMohfezName(e.target.value); if (e.target.value) setIncludeMohfez(true); }}
                  disabled={!includeMohfez}
                >
                  <option value="">-- اختر المحفظ --</option>
                  {mohfezOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={includeCoordinator} onChange={e => setIncludeCoordinator(e.target.checked)} />
                  المنسق
                </label>
                <select
                  className="form-select"
                  value={coordinatorName}
                  onChange={e => { setCoordinatorName(e.target.value); if (e.target.value) setIncludeCoordinator(true); }}
                  disabled={!includeCoordinator}
                >
                  <option value="">-- اختر المنسق --</option>
                  {coordinatorOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 10 }}>
              <label>ملاحظات (اختياري)</label>
              <input
                type="text"
                className="form-input"
                placeholder="أي ملاحظات إضافية..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Check size={16} /> {saving ? 'جارٍ الحفظ...' : editingLogId ? 'حفظ التعديل' : 'حفظ سجل العمل'}
              </button>
              {editingLogId && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setEditingLogId(null); setNotes(''); }}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>

          <div className="box-card">
            <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} /> السجلات المسجلة ({scopedLogs.length})
            </h3>
            <div className="table-wrapper">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المجموعة</th>
                    <th>المشرف العلمي</th>
                    <th>المشرف التقني</th>
                    <th>المحفظ</th>
                    <th>المنسق</th>
                    <th>من - إلى</th>
                    <th>الساعات</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        لا توجد سجلات عمل مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    scopedLogs.map(log => (
                      <tr key={log.id || log._id}>
                        <td dir="ltr">{log.work_date}</td>
                        <td>مجموعة {log.group_no}</td>
                        <td>{log.scientific_supervisor || '-'}</td>
                        <td>{log.technical_supervisor || '-'}</td>
                        <td>{log.mohfez || '-'}</td>
                        <td>{log.coordinator || '-'}</td>
                        <td>{formatTime12Ar(log.time_from) || log.time_from} - {formatTime12Ar(log.time_to) || log.time_to}</td>
                        <td style={{ fontWeight: 'bold' }}>{formatNum(log.hours)} س</td>
                        <td className="actions-cell">
                          <button type="button" className="action-icon edit" title="تعديل" onClick={() => handleEditLog(log)}>
                            <Edit size={15} />
                          </button>
                          <button type="button" className="action-icon delete" title="حذف" onClick={() => handleDeleteLog(log)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'report' && (
        <div>
          <div className="box-card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>من تاريخ</label>
                <input type="date" className="form-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>إلى تاريخ</label>
                <input type="date" className="form-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>المجموعة</label>
                <select className="form-select" value={filterGroupNo} onChange={e => setFilterGroupNo(e.target.value)}>
                  <option value="">جميع المجموعات</option>
                  {accessibleGroups.map(g => (
                    <option key={g.group_no} value={g.group_no}>مجموعة {g.group_no}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>الصفة</label>
                <select className="form-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                  <option value="ALL">الجميع</option>
                  <option value="scientific_supervisor">المشرف العلمي</option>
                  <option value="technical_supervisor">المشرف التقني</option>
                  <option value="coordinator">المنسق</option>
                  <option value="mohfez">المحفظ</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>بحث (اسم / قومي / سجل)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ابحث..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${reportViewMode === 'summary' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setReportViewMode('summary')}
                >
                  <Users size={15} /> كشف إجمالي للأفراد ({summaryRows.length})
                </button>
                <button
                  type="button"
                  className={`btn ${reportViewMode === 'detailed' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setReportViewMode('detailed')}
                >
                  <Calendar size={15} /> كشف تفصيلي يومي ({detailedEntries.length})
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-gold-outline" onClick={handlePrintPDF}>
                  <Printer size={16} /> طباعة كشف PDF
                </button>
                <button type="button" className="btn btn-outline" onClick={handleExportExcel}>
                  <Download size={16} /> تصدير إكسيل
                </button>
              </div>
            </div>
          </div>

          <div className="box-card">
            <div className="table-wrapper">
              {reportViewMode === 'summary' ? (
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>الاسم</th>
                      <th>الصفة</th>
                      <th>الرقم القومي</th>
                      <th>رقم السجل</th>
                      <th>المجموعات</th>
                      <th>أيام التواجد</th>
                      <th>إجمالي الساعات</th>
                      <th>صافي المستحق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>لا توجد بيانات مطابقة</td></tr>
                    ) : (
                      summaryRows.map((r, idx) => (
                        <tr key={`${r.roleKey}-${r.name}`}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{r.name}</td>
                          <td>{r.roleLabel}</td>
                          <td dir="ltr">{r.national_id || '-'}</td>
                          <td dir="ltr">{r.registry_no || '-'}</td>
                          <td>{r.groupsList}</td>
                          <td>{r.daysWorkedCount}</td>
                          <td>{formatNum(r.totalHours)}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>{r.entitlementText}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>التاريخ</th>
                      <th>المجموعة</th>
                      <th>الاسم</th>
                      <th>الصفة</th>
                      <th>الرقم القومي</th>
                      <th>رقم السجل</th>
                      <th>من</th>
                      <th>إلى</th>
                      <th>الساعات</th>
                      <th>المستحق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedEntries.length === 0 ? (
                      <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>لا توجد بيانات مطابقة</td></tr>
                    ) : (
                      detailedEntries.map((r, idx) => (
                        <tr key={`${r.logId}-${r.roleKey}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td dir="ltr">{r.work_date}</td>
                          <td>مجموعة {r.group_no}</td>
                          <td style={{ fontWeight: 'bold' }}>{r.name}</td>
                          <td>{r.roleLabel}</td>
                          <td dir="ltr">{r.national_id || '-'}</td>
                          <td dir="ltr">{r.registry_no || '-'}</td>
                          <td>{formatTime12Ar(r.time_from) || r.time_from}</td>
                          <td>{formatTime12Ar(r.time_to) || r.time_to}</td>
                          <td>{formatNum(r.hours)}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                            {r.roleKey === 'mohfez' ? `${formatNum(r.hours)} ساعة` : `${formatNum(r.days)} يوم`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlacementWorkLogs;
