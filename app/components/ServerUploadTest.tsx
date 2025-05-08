import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '@/app/utils/theme';
import { uploadImageToServer, uploadBase64ImageToServer, isServerAvailable } from '@/app/utils/imageServer';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ServerUploadTest() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Check server status when component mounts
    checkServerStatus();

    // Set up periodic server status check every 30 seconds
    const intervalId = setInterval(() => {
      checkServerStatus(false); // Silent check
    }, 30000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prevLogs]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const checkServerStatus = async (showLoading = true) => {
    if (showLoading) {
      addLog('Checking server status...');
      setServerStatus('checking');
    }
    
    try {
      const isAvailable = await isServerAvailable();
      setServerStatus(isAvailable ? 'online' : 'offline');
      
      if (showLoading) {
        addLog(`Server is ${isAvailable ? 'online' : 'offline'}`);
      }
      
      // Reset retry count if server is online
      if (isAvailable) {
        setRetryCount(0);
      }
    } catch (error) {
      setServerStatus('offline');
      if (showLoading) {
        addLog(`Server check failed: ${error}`);
      }
      
      // Retry logic for failed server checks
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        addLog(`Retrying server check (${retryCount + 1}/3)...`);
        setTimeout(() => checkServerStatus(), 2000);
      }
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need camera roll permission to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setSelectedImage(selectedUri);
        addLog(`Selected image: ${selectedUri}`);
      }
    } catch (error) {
      addLog(`Error picking image: ${error}`);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadWithDirectMethod = async () => {
    if (!selectedImage) {
      Alert.alert('No image', 'Please select an image first');
      return;
    }

    if (serverStatus !== 'online') {
      Alert.alert('Server offline', 'Image upload server is not accessible');
      return;
    }

    setIsLoading(true);
    addLog('Starting direct image upload...');

    try {
      const imageUrl = await uploadImageToServer(selectedImage);
      
      if (imageUrl) {
        setUploadedImageUrl(imageUrl);
        addLog(`Upload successful: ${imageUrl}`);
        Alert.alert('Success', 'Image uploaded successfully');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      addLog(`Upload error: ${error}`);
      Alert.alert('Upload failed', error?.toString() || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadWithBase64Method = async () => {
    if (!selectedImage) {
      Alert.alert('No image', 'Please select an image first');
      return;
    }

    if (serverStatus !== 'online') {
      Alert.alert('Server offline', 'Image upload server is not accessible');
      return;
    }

    setIsLoading(true);
    addLog('Starting base64 image upload...');

    try {
      const imageUrl = await uploadBase64ImageToServer(selectedImage);
      
      if (imageUrl) {
        setUploadedImageUrl(imageUrl);
        addLog(`Base64 upload successful: ${imageUrl}`);
        Alert.alert('Success', 'Base64 image uploaded successfully');
      } else {
        throw new Error('Base64 upload failed');
      }
    } catch (error) {
      addLog(`Base64 upload error: ${error}`);
      Alert.alert('Upload failed', error?.toString() || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const openImageUrl = () => {
    if (uploadedImageUrl) {
      Linking.openURL(uploadedImageUrl).catch(err => {
        addLog(`Error opening URL: ${err}`);
        Alert.alert('Error', 'Cannot open URL');
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Server Upload Test</Text>
        
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.serverStatus}>
        <Text style={styles.statusLabel}>Server Status:</Text>
        <View style={styles.statusIndicator}>
          {serverStatus === 'checking' ? (
            <ActivityIndicator size="small" color={THEME.primary} />
          ) : (
            <View style={[
              styles.statusDot,
              { backgroundColor: serverStatus === 'online' ? THEME.success : THEME.danger }
            ]} />
          )}
          <Text style={[
            styles.statusText,
            { color: serverStatus === 'online' ? THEME.success : 
                     serverStatus === 'offline' ? THEME.danger : THEME.textPrimary }
          ]}>
            {serverStatus === 'checking'
              ? 'Checking...'
              : serverStatus === 'online'
                ? 'Online'
                : 'Offline'
            }
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => checkServerStatus()}
        >
          <Ionicons name="refresh" size={18} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.imageContainer}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={64} color={THEME.textSecondary} />
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.button}
          onPress={pickImage}
          disabled={isLoading}
        >
          <Ionicons name="image" size={20} color="white" />
          <Text style={styles.buttonText}>Select Image</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button, 
            { backgroundColor: THEME.accent },
            (isLoading || serverStatus !== 'online' || !selectedImage) && styles.disabledButton
          ]}
          onPress={uploadWithDirectMethod}
          disabled={!selectedImage || isLoading || serverStatus !== 'online'}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="white" />
              <Text style={styles.buttonText}>Direct Upload</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button, 
            { backgroundColor: THEME.info },
            (isLoading || serverStatus !== 'online' || !selectedImage) && styles.disabledButton
          ]}
          onPress={uploadWithBase64Method}
          disabled={!selectedImage || isLoading || serverStatus !== 'online'}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="code" size={20} color="white" />
              <Text style={styles.buttonText}>Base64 Upload</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {uploadedImageUrl && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Uploaded Image URL:</Text>
          
          <TouchableOpacity onPress={openImageUrl}>
            <Text style={styles.resultUrl}>{uploadedImageUrl}</Text>
          </TouchableOpacity>
          
          <View style={styles.resultImageContainer}>
            <Image 
              source={{ uri: uploadedImageUrl }} 
              style={styles.resultImage}
              onError={() => addLog('Error loading uploaded image')}
            />
            <TouchableOpacity 
              style={styles.openUrlButton}
              onPress={openImageUrl}
            >
              <Ionicons name="open-outline" size={18} color="white" />
              <Text style={styles.openUrlText}>Open URL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.logsContainer}>
        <View style={styles.logHeader}>
          <Text style={styles.logsTitle}>Logs:</Text>
          <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
          {logs.length === 0 && (
            <Text style={styles.emptyLogText}>No logs yet. Actions will be recorded here.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    marginLeft: 12,
    padding: 8,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  imagePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    backgroundColor: THEME.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: THEME.textSecondary,
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  resultContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: THEME.light,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultUrl: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  resultImageContainer: {
    alignItems: 'center',
  },
  resultImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  openUrlButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  openUrlText: {
    color: 'white',
    marginLeft: 4,
    fontSize: 14,
  },
  logsContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 6,
    backgroundColor: THEME.light,
    borderRadius: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  logScroll: {
    maxHeight: 150,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  emptyLogText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
}); 