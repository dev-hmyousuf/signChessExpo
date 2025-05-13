/**
 * Helper functions to deal with array data in Appwrite
 */

/**
 * Properly format arrays for Appwrite database updates
 * 
 * This function ensures that array fields are properly formatted before sending to Appwrite
 * Appwrite requires arrays to be sent as proper arrays, not single values
 */
export const formatArraysForAppwrite = (data: any) => {
  const formattedData = { ...data };

  // Process all properties in the data object
  Object.keys(formattedData).forEach(key => {
    const value = formattedData[key];
    
    // Check if the field should be an array but isn't currently
    if (isFieldSupposedToBeArray(key) && !Array.isArray(value)) {
      // Convert to array if it's not null/undefined
      if (value !== null && value !== undefined) {
        formattedData[key] = [value];
      } else {
        formattedData[key] = [];
      }
    }
  });
  
  return formattedData;
};

/**
 * Check if a field should be an array based on known array fields in the application
 */
export const isFieldSupposedToBeArray = (fieldName: string): boolean => {
  // List of fields that are known to be arrays in your appwrite collections
  const arrayFields = [
    'movesPlayed',
    // Add other array fields in your schema here
  ];
  
  return arrayFields.includes(fieldName);
};

/**
 * Properly append a new item to an existing array
 * 
 * @param existingArray The existing array or single value 
 * @param newValue The new value to append
 */
export const appendToArray = (existingArray: any, newValue: any): any[] => {
  // If existingArray is null or undefined, return an array with just the new value
  if (existingArray === null || existingArray === undefined) {
    return [newValue];
  }
  
  // If existingArray is already an array, append the new value
  if (Array.isArray(existingArray)) {
    return [...existingArray, newValue];
  }
  
  // If existingArray is a single value, convert to array with both values
  return [existingArray, newValue];
};

/**
 * Safely access an array field, ensuring it's always returned as an array
 */
export const safelyGetArray = (obj: any, fieldName: string): any[] => {
  const value = obj?.[fieldName];
  
  if (value === null || value === undefined) {
    return [];
  }
  
  if (Array.isArray(value)) {
    return value;
  }
  
  // Convert single value to array
  return [value];
}; 