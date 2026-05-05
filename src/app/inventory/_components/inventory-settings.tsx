"use client";

import { useState } from "react";
import { Bell, Building2, Lock, Save, User } from "lucide-react";

function Toggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 w-14 rounded-full transition-colors ${
        checked ? "bg-gray-900" : "bg-gray-300"
      }`}
    >
      <div
        className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function InventorySettings() {
  const [companyName, setCompanyName] = useState("Premium Marble Co.");
  const [email, setEmail] = useState("admin@marble.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [notifications, setNotifications] = useState(true);

  const handleSave = () => {
    window.alert("Settings saved successfully!");
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Settings
        </h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="max-w-4xl space-y-4 md:space-y-6">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Building2 className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Company Information
            </h2>
          </div>
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                GST Number
              </label>
              <input
                type="text"
                placeholder="22AAAAA0000A1Z5"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <User className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              User Profile
            </h2>
          </div>
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                defaultValue="Admin User"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Role
              </label>
              <select className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800">
                <option>Administrator</option>
                <option>Manager</option>
                <option>Staff</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Lock className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Security
            </h2>
          </div>
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Current Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Bell className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Notifications
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Low Stock Alerts</p>
                <p className="text-sm text-gray-500">
                  Get notified when inventory is low
                </p>
              </div>
              <Toggle
                checked={notifications}
                onClick={() => setNotifications(!notifications)}
              />
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <p className="font-medium text-gray-900">Reservation Reminders</p>
                <p className="text-sm text-gray-500">
                  Reminders for reserved slabs
                </p>
              </div>
              <Toggle checked />
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <p className="font-medium text-gray-900">Stock Movement Alerts</p>
                <p className="text-sm text-gray-500">
                  Notifications for stock transfers
                </p>
              </div>
              <Toggle checked={false} />
            </div>
          </div>
        </section>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:gap-4">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-8 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <Save className="h-5 w-5" />
            Save Changes
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-8 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
