

export default class ElectronNetworkListener {
  static async getIsOnline(): Promise<boolean> {
    // Simple check - if we can access Node.js network interfaces, assume online
    try {
      const os = await import('os');
      const interfaces = os.networkInterfaces();
      
      // Check if we have any active non-loopback interfaces
      for (const addresses of Object.values(interfaces)) {
        if (addresses) {
          for (const addr of addresses) {
            if (!addr.internal && (addr.family === 'IPv4' || addr.family === 'IPv6')) {
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      // Fallback - assume online if we can't detect
      return true;
    }
  }

  static listen(callback: (isOnline: boolean) => void): () => void {
    let intervalId: NodeJS.Timeout;
    let lastOnlineStatus: boolean | null = null;

    const checkConnectivity = async () => {
      try {
        const isOnline = await ElectronNetworkListener.getIsOnline();
        
        // Only notify if status changed
        if (lastOnlineStatus !== null && lastOnlineStatus !== isOnline) {
          callback(isOnline);
        } else if (lastOnlineStatus === null) {
          callback(isOnline);
        }
        
        lastOnlineStatus = isOnline;
      } catch (error) {
        // Ignore errors, maintain last known state
      }
    };

    // Check connectivity every 10 seconds (configurable via ELECTRON_INSTANT_NETWORK_CHECK_INTERVAL env var)
    const checkInterval = parseInt(process.env.ELECTRON_INSTANT_NETWORK_CHECK_INTERVAL || '10000');
    intervalId = setInterval(checkConnectivity, checkInterval);
    
    // Initial check
    checkConnectivity();

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }
} 