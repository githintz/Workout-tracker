import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])

  const refresh = useCallback(() => {
    if (!user?.email) return Promise.resolve()
    return supabase.from('notifications')
      .select('*, plan_shares(status, plan_id)')
      .ilike('recipient_email', user.email)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setNotifications(data || []))
  }, [user])

  useEffect(() => {
    if (!user?.email) return
    const load = () => { refresh() }
    load()
    // Live updates when someone sends something; poll as a fallback
    const channel = supabase.channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe()
    const timer = setInterval(load, 60_000)
    return () => { clearInterval(timer); supabase.removeChannel(channel) }
  }, [user, refresh])

  const unreadCount = notifications.filter(n => !n.read).length

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read && n.type !== 'plan_shared').map(n => n.id)
    if (ids.length === 0) return
    setNotifications(ns => ns.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).in('id', ids)
  }

  async function remove(id) {
    setNotifications(ns => ns.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  async function acceptShare(shareId) {
    const { data, error } = await supabase.rpc('accept_plan_share', { share_id: shareId })
    await refresh()
    return { planId: data, error }
  }

  async function declineShare(shareId) {
    const { error } = await supabase.rpc('decline_plan_share', { share_id: shareId })
    await refresh()
    return { error }
  }

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, refresh, markAllRead, remove, acceptShare, declineShare }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationsContext)
