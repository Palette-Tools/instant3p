// Dynamic network listener that allows switching between online/offline modes at runtime
export default class DynamicNetworkListener {
  constructor(initialState = false) {
    this._isOnline = initialState;
    this._listeners = [];
  }
  
  async getIsOnline() {
    return this._isOnline;
  }
  
  listen(callback) {
    // Add the callback to our listeners
    this._listeners.push(callback);
    
    // Immediately call with current state
    callback(this._isOnline);
    
    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter(listener => listener !== callback);
    };
  }
  
  setOnline(isOnline) {
    if (this._isOnline !== isOnline) {
      this._isOnline = isOnline;
      // Notify all listeners (including Reactor) of the change
      this._listeners.forEach(listener => listener(isOnline));
    }
  }
  
  // Getter for current state
  get isOnline() {
    return this._isOnline;
  }
} 