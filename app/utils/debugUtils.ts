import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Save debug information to AsyncStorage
 */
export const saveDebugInfo = async (key: string, data: any) => {
  try {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      data
    };
    await AsyncStorage.setItem(`debug_${key}_${timestamp}`, JSON.stringify(entry));
    console.log(`Debug info saved for ${key} at ${timestamp}`);
  } catch (error) {
    console.error('Error saving debug info:', error);
  }
};

/**
 * Get all debug logs
 */
export const getAllDebugLogs = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const debugKeys = keys.filter(key => key.startsWith('debug_'));
    const result: any = {};
    
    for (const key of debugKeys) {
      const value = await AsyncStorage.getItem(key);
      result[key] = value ? JSON.parse(value) : null;
    }
    
    return result;
  } catch (error) {
    console.error('Error getting debug logs:', error);
    return {};
  }
};

/**
 * Clear all debug logs
 */
export const clearDebugLogs = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const debugKeys = keys.filter(key => key.startsWith('debug_'));
    await AsyncStorage.multiRemove(debugKeys);
    console.log(`Cleared ${debugKeys.length} debug logs`);
  } catch (error) {
    console.error('Error clearing debug logs:', error);
  }
};

/**
 * Analyze any issues with move data
 */
export const analyzeMoveData = (movesPlayed: any) => {
  const result = {
    isValid: false,
    isArray: false,
    length: 0,
    type: typeof movesPlayed,
    details: ''
  };
  
  if (movesPlayed === null || movesPlayed === undefined) {
    result.details = 'movesPlayed is null or undefined';
    return result;
  }
  
  result.isArray = Array.isArray(movesPlayed);
  
  if (!result.isArray) {
    result.details = `movesPlayed is not an array, it's a ${typeof movesPlayed}`;
    return result;
  }
  
  result.length = movesPlayed.length;
  result.isValid = true;
  result.details = `Valid array with ${movesPlayed.length} moves`;
  
  return result;
}; 