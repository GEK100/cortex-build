import { flushQueue, getPendingCount } from './queue'
import { toast } from 'sonner'

/**
 * Initialise the sync listener. Called once on app mount.
 * Flushes the offline queue when coming back online.
 */
export function initSyncListener() {
  // Flush when coming back online
  window.addEventListener('online', async () => {
    const count = await getPendingCount()
    if (count > 0) {
      toast.info(`Syncing ${count} offline capture${count > 1 ? 's' : ''}...`)
      const { synced, failed } = await flushQueue()

      if (synced > 0) {
        toast.success(`Synced ${synced} capture${synced > 1 ? 's' : ''}`)
      }
      if (failed > 0) {
        toast.error(`${failed} capture${failed > 1 ? 's' : ''} failed to sync`)
      }
    }
  })

  // Also try to flush on load if online (in case items were queued and browser was closed)
  if (navigator.onLine) {
    flushQueue().catch(() => {})
  }
}
