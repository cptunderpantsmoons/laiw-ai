import { useState, useEffect } from 'react'
import { fetchApi } from '../api'
import { Budget, Transaction, Matter } from '../types'

export default function Spend() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedMatterId, setSelectedMatterId] = useState<string>('')
  const [matters, setMatters] = useState<Matter[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchApi<Budget[]>('/spend/budgets'),
      fetchApi<Transaction[]>('/spend/transactions'),
      fetchApi<Matter[]>('/matters'),
    ])
      .then(([budgetsRes, transactionsRes, mattersRes]) => {
        if (!cancelled) {
          setBudgets(budgetsRes)
          setTransactions(transactionsRes)
          setMatters(mattersRes)
          if (mattersRes.length > 0 && !selectedMatterId) {
            setSelectedMatterId(mattersRes[0].id)
          }
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [selectedMatterId])

  const filteredTransactions = selectedMatterId
    ? transactions.filter(t => t.matterId === selectedMatterId)
    : transactions

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading spend data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Spend Management</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading spend data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Matter Filter */}
      {matters.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Matter</label>
          <select
            value={selectedMatterId}
            onChange={e => setSelectedMatterId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Matters</option>
            {matters.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {budgets.map(budget => (
            <BudgetCard key={budget.matterId} budget={budget} />
          ))}
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Transactions</h2>
        {filteredTransactions.length === 0 ? (
          <p className="text-slate-500 text-sm">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Vendor</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">{tx.type || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{tx.vendorName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tx.status === 'paid' ? 'bg-green-100 text-green-700' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function BudgetCard({ budget }: { budget: Budget }) {
  const pct = budget.totalAmount > 0
    ? Math.round((budget.spent / budget.totalAmount) * 100)
    : 0
  const overBudget = pct > 100

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Budget</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            ${budget.totalAmount.toLocaleString()}
          </p>
        </div>
        <span className={`text-sm font-medium ${overBudget ? 'text-red-600' : 'text-slate-600'}`}>
          {pct}% used
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-primary-600'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Spent</p>
          <p className="font-medium text-slate-900">
            ${budget.spent.toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-500">Remaining</p>
          <p className={`font-medium ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
            ${budget.remaining.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
