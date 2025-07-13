// Always-offline network listener for offline-only mode
export default class OfflineNetworkListener {
  static async getIsOnline() {
    return false; // Always report offline
  }
  
  static listen(f) {
    // Always report offline, never change status
    f(false);
    
    // Return a no-op unsubscribe function
    return () => {};
  }
} 