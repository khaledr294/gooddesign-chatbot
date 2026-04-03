'use client';

import { useState, type FormEvent } from 'react';
import useSWR, { mutate } from 'swr';
import { apiFetch, getAgent } from '@/lib/api';

interface ApiAgent {
  id: string;
  name: string;
  email: string;
  role: string;
  maxConcurrentChats: number;
  categories: { agentId: string; categoryId: string; category: { id: string; name: string } }[];
  _count: { conversations: number };
}

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  maxConcurrentChats: number;
  categories: { id: string; name: string }[];
}

interface Category {
  id: string;
  name: string;
  sallaId: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'agents' | 'settings'>('agents');
  const currentAgent = getAgent();
  const isAdmin = currentAgent?.role === 'ADMIN';

  return (
    <div className="p-6">
      <h2 className="mb-6 text-xl font-bold">الإعدادات</h2>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab('agents')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${
            tab === 'agents' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          إدارة الموظفين
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${
            tab === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          إعدادات عامة
        </button>
      </div>

      {tab === 'agents' && isAdmin && <AgentsSection />}
      {tab === 'agents' && !isAdmin && (
        <p className="text-sm text-gray-500">فقط المدير يمكنه إدارة الموظفين</p>
      )}
      {tab === 'settings' && isAdmin && <GeneralSettings />}
      {tab === 'settings' && !isAdmin && (
        <p className="text-sm text-gray-500">فقط المدير يمكنه تعديل الإعدادات</p>
      )}
    </div>
  );
}

function AgentsSection() {
  const { data: rawAgents = [] } = useSWR<ApiAgent[]>('/agents', apiFetch);
  const agents: Agent[] = rawAgents.map((a) => ({
    ...a,
    categories: a.categories?.map((ac) => ac.category) ?? [],
  }));
  const { data: categories = [] } = useSWR<Category[]>('/categories', apiFetch);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="rounded-xl bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          + إضافة موظف
        </button>
        <h3 className="text-lg font-semibold">الموظفون</h3>
      </div>

      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
            <button
              onClick={() => { setEditing(a); setCreating(false); }}
              className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30"
            >
              تعديل
            </button>
            <div className="text-right flex-1 mr-3">
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-gray-400">{a.email} • {a.role === 'ADMIN' ? 'مدير' : 'موظف'}</p>
              <div className="flex gap-1 mt-1 justify-end flex-wrap">
                {a.categories?.map((c) => (
                  <span key={c.id} className="rounded-full bg-purple-600/20 px-2 py-0.5 text-xs text-purple-400">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <AgentForm
          agent={editing}
          categories={categories}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={() => {
            mutate('/agents');
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function AgentForm({
  agent,
  categories,
  onClose,
  onSave,
}: {
  agent: Agent | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(agent?.name ?? '');
  const [email, setEmail] = useState(agent?.email ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(agent?.role ?? 'AGENT');
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(agent?.maxConcurrentChats ?? 10);
  const [selectedCats, setSelectedCats] = useState<string[]>(
    agent?.categories?.map((c) => c.id) ?? []
  );
  const [loading, setLoading] = useState(false);

  function toggleCat(id: string) {
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: any = { name, email, phone, role, maxConcurrentChats, categoryIds: selectedCats };
      if (password) body.password = password;

      if (agent) {
        await apiFetch(`/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        body.password = password || 'changeme123';
        await apiFetch('/agents', { method: 'POST', body: JSON.stringify(body) });
      }
      onSave();
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6"
      >
        <h3 className="mb-4 text-lg font-bold">{agent ? 'تعديل موظف' : 'إضافة موظف'}</h3>

        <label className="mb-1 block text-sm text-gray-400">الاسم</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm text-gray-400">البريد الإلكتروني</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm text-gray-400">رقم الجوال</label>
        <input
          type="tel"
          required={!agent}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+966500000000"
          dir="ltr"
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm text-gray-400">
          كلمة المرور {agent ? '(اتركها فارغة لعدم التغيير)' : ''}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm text-gray-400">الصلاحية</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          <option value="AGENT">موظف</option>
          <option value="ADMIN">مدير</option>
        </select>

        <label className="mb-1 block text-sm text-gray-400">الحد الأقصى للمحادثات</label>
        <input
          type="number"
          min={1}
          max={50}
          value={maxConcurrentChats}
          onChange={(e) => setMaxConcurrentChats(Number(e.target.value))}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-2 block text-sm text-gray-400">الفئات المخصصة</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCat(c.id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selectedCats.includes(c.id)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-gray-500">قم بمزامنة المنتجات أولاً لعرض الفئات</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-400 hover:text-white"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </div>
  );
}

function GeneralSettings() {
  const { data: settings = {} } = useSWR<Record<string, string>>('/settings', apiFetch);
  const [saving, setSaving] = useState<string | null>(null);

  const settingsList = [
    { key: 'welcome_message', label: 'رسالة الترحيب', type: 'textarea' },
    { key: 'bank_name', label: 'اسم البنك', type: 'text' },
    { key: 'bank_iban', label: 'رقم الآيبان', type: 'text' },
    { key: 'bank_account_name', label: 'اسم صاحب الحساب', type: 'text' },
    { key: 'working_hours', label: 'ساعات العمل', type: 'text' },
    { key: 'delivery_areas', label: 'مناطق التوصيل', type: 'text' },
  ];

  function getValue(key: string) {
    return settings[key] ?? '';
  }

  async function saveSetting(key: string, value: string) {
    setSaving(key);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      });
      mutate('/settings');
    } catch {
      // error
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-xl bg-gray-900 p-5 space-y-4">
      <h3 className="text-lg font-semibold mb-4">إعدادات عامة</h3>

      {settingsList.map((s) => (
        <SettingRow
          key={s.key}
          label={s.label}
          type={s.type}
          value={getValue(s.key)}
          saving={saving === s.key}
          onSave={(v) => saveSetting(s.key, v)}
        />
      ))}

      <div className="border-t border-gray-800 pt-4">
        <button
          onClick={async () => {
            await apiFetch('/sync-products', { method: 'POST' });
            alert('تم بدء مزامنة المنتجات');
          }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        >
          مزامنة المنتجات من سلة
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  type,
  value: initial,
  saving,
  onSave,
}: {
  label: string;
  type: string;
  value: string;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const changed = value !== initial;

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-400">{label}</label>
      <div className="flex gap-2">
        {changed && (
          <button
            onClick={() => onSave(value)}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '...' : 'حفظ'}
          </button>
        )}
        {type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
