// screens/DashboardScreen.js

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase/config';
import { getBreakSuggestion } from '../services/aiService';
import { getTodayRange } from '../utils/timeUtils';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [breakSuggestion, setBreakSuggestion] = useState(null);
  const { user } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [currentBreak, setCurrentBreak] = useState(null);

  // Format a timestamp to a short time string
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch today's logs from Firestore
  const fetchTodayLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { startOfDay, endOfDay } = getTodayRange();

      // Fetch time logs
      const logsSnapshot = await db
        .collection('timeLogs')
        .where('userId', '==', user.uid)
        .where('checkIn', '>=', startOfDay)
        .where('checkIn', '<=', endOfDay)
        .orderBy('checkIn', 'desc')
        .get();

      const logs = [];
      
      for (const doc of logsSnapshot.docs) {
        const logData = {
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn.toDate(),
          checkOut: doc.data().checkOut?.toDate()
        };

        try {
          // Fetch breaks for this log
          const breaksSnapshot = await db
            .collection('breaks')
            .where('userId', '==', user.uid)
            .where('timeLogId', '==', doc.id)
            .orderBy('startTime', 'asc')
            .get();

          logData.breaks = breaksSnapshot.docs.map(breakDoc => ({
            id: breakDoc.id,
            ...breakDoc.data(),
            startTime: breakDoc.data().startTime.toDate(),
            endTime: breakDoc.data().endTime?.toDate()
          }));
        } catch (breakError) {
          console.error('Error fetching breaks:', breakError);
          logData.breaks = []; // Set empty breaks array if fetch fails
        }

        logs.push(logData);
      }

      setTodayLogs(logs);

      // Check for active session and break
      const activeLog = logs.find(log => !log.checkOut);
      setActiveSession(activeLog || null);

      if (activeLog) {
        const activeBreak = activeLog.breaks?.find(b => !b.endTime);
        if (activeBreak) {
          setCurrentBreak(activeBreak);
          setIsOnBreak(true);
        } else {
          setCurrentBreak(null);
          setIsOnBreak(false);
        }
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setTodayLogs([]);
      setActiveSession(null);
      setCurrentBreak(null);
      setIsOnBreak(false);
    } finally {
      setLoading(false);
    }
  };

  // Calculate session duration from start time until now
  const calculateDuration = (startTime) => {
    if (!startTime) return '0m';
    const now = new Date();
    const start = startTime instanceof Date ? startTime : startTime.toDate();
    const diff = Math.floor((now - start) / 1000 / 60); // in minutes
    if (diff < 60) {
      return `${diff}m`;
    }
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  // Delete a log entry after a confirmation
  const handleDeleteLog = (logId) => {
    Alert.alert(
      "Delete Log",
      "Are you sure you want to delete this time log?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              
              // Get the log to delete
              const logRef = db.collection('timeLogs').doc(logId);
              const logDoc = await logRef.get();
              
              if (!logDoc.exists) {
                throw new Error('Log not found');
              }

              // Create audit record with the original log data
              const auditData = {
                logId: logId,
                userId: user.uid,
                action: 'delete',
                deletedAt: new Date(),
                deletedBy: user.uid,
                logData: {
                  ...logDoc.data(),
                  checkIn: logDoc.data().checkIn,
                  checkOut: logDoc.data().checkOut
                }
              };

              // Create the audit record first
              await db.collection('timeLogsAudit').add(auditData);

              // Then delete associated breaks
              const breaksSnapshot = await db
                .collection('breaks')
                .where('timeLogId', '==', logId)
                .where('userId', '==', user.uid)
                .get();

              for (const breakDoc of breaksSnapshot.docs) {
                await breakDoc.ref.delete();
              }

              // Finally delete the log
              await logRef.delete();
              
              // Refresh the logs
              fetchTodayLogs();
              Alert.alert('Success', 'Time log deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete time log');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Hide the default navigation header (if using react-navigation)
  useEffect(() => {
    if (navigation?.setOptions) {
      navigation.setOptions({
        headerShown: false,
      });
    }
    if (user) {
      fetchTodayLogs();
    }
  }, [user]);

  const handleCheckIn = async () => {
    if (!user) return;
    
    try {
      const checkInTime = new Date();
      const docRef = await db.collection('timeLogs').add({
        userId: user.uid,
        checkIn: checkInTime,
        createdAt: checkInTime
      });

      setActiveSession({
        id: docRef.id,
        checkIn: checkInTime
      });

      await fetchTodayLogs();
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    }
  };

  const handleCheckOut = async () => {
    if (!activeSession) return;

    try {
      const checkOutTime = new Date();
      await db.collection('timeLogs').doc(activeSession.id).update({
        checkOut: checkOutTime,
        updatedAt: checkOutTime
      });

      setActiveSession(null);
      await fetchTodayLogs();
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Error', 'Failed to check out. Please try again.');
    }
  };

  // Add this function to get break suggestions
  const checkBreakSuggestion = async (sessionStartTime) => {
    if (!sessionStartTime) return;
    
    const now = new Date();
    const start = sessionStartTime instanceof Date ? sessionStartTime : sessionStartTime.toDate();
    const durationMinutes = (now - start) / (1000 * 60);
    
    // Only clear suggestion when on break
    if (isOnBreak) {
      setBreakSuggestion(null);
      return;
    }

    // Show different suggestions based on duration
    if (durationMinutes >= 45 && durationMinutes < 90) {
      try {
        const suggestion = "You've been working for 45 minutes. Consider taking a short break!";
        setBreakSuggestion(suggestion);
      } catch (error) {
        console.error('Error getting break suggestion:', error);
      }
    } else if (durationMinutes >= 90) {
      try {
        const suggestion = "You've been working for over 90 minutes. Time for a proper break!";
        setBreakSuggestion(suggestion);
      } catch (error) {
        console.error('Error getting break suggestion:', error);
      }
    }
  };

  // Update useEffect to include break suggestions
  useEffect(() => {
    if (activeSession && !isOnBreak) {
      checkBreakSuggestion(activeSession.checkIn);
      
      const interval = setInterval(() => {
        checkBreakSuggestion(activeSession.checkIn);
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(interval);
    }
  }, [activeSession, isOnBreak]); // Watch for break status changes

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodayLogs();
    setRefreshing(false);
  }, [user]);

  // Add break handling functions
  const handleStartBreak = async (isPaid) => {
    if (!activeSession || isOnBreak) return;

    try {
      const breakStartTime = new Date();
      const breakRef = await db.collection('breaks').add({
        userId: user.uid,
        timeLogId: activeSession.id,
        startTime: breakStartTime,
        isPaid: isPaid,
        createdAt: breakStartTime,
        status: 'active'
      });

      setCurrentBreak({
        id: breakRef.id,
        startTime: breakStartTime,
        isPaid: isPaid,
        status: 'active'
      });
      setIsOnBreak(true);
      
      // Show confirmation toast or alert
      Alert.alert(
        'Break Started',
        `You are now on a ${isPaid ? 'paid' : 'unpaid'} break`
      );
    } catch (error) {
      console.error('Start break error:', error);
      Alert.alert('Error', 'Failed to start break. Please try again.');
    }
  };

  const handleEndBreak = async () => {
    if (!currentBreak || !isOnBreak) return;

    try {
      const breakEndTime = new Date();
      await db.collection('breaks').doc(currentBreak.id).update({
        endTime: breakEndTime,
        updatedAt: breakEndTime,
        duration: (breakEndTime - currentBreak.startTime) / (1000 * 60), // duration in minutes
        status: 'completed'
      });

      setCurrentBreak(null);
      setIsOnBreak(false);
      await fetchTodayLogs(); // Refresh logs to show updated break

      // Show confirmation
      Alert.alert('Break Ended', 'Your break has been recorded');
    } catch (error) {
      console.error('End break error:', error);
      Alert.alert('Error', 'Failed to end break. Please try again.');
    }
  };

  // Add status indicator component
  const renderStatusIndicator = () => {
    if (!activeSession) return null;

    return (
      <View style={styles.statusIndicator}>
        <View style={[
          styles.statusDot,
          isOnBreak ? styles.statusBreak : styles.statusActive
        ]} />
        <Text style={styles.statusText}>
          {isOnBreak 
            ? `On ${currentBreak?.isPaid ? 'Paid' : 'Unpaid'} Break` 
            : 'Working'}
        </Text>
      </View>
    );
  };

  // Modify status card content
  const renderStatusCard = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <Ionicons name="time-outline" size={24} color="#4c669f" />
        <Text style={styles.statusTitle}>Current Status</Text>
      </View>
      <View style={styles.statusContent}>
        {renderStatusIndicator()}
        {activeSession ? (
          <>
            <Text style={styles.activeSessionText}>
              {isOnBreak ? 'Break Active' : 'Session Active'}
            </Text>
            <Text style={styles.timeText}>
              Started at: {formatTime(activeSession.checkIn)}
            </Text>
            <Text style={styles.durationText}>
              Duration: {calculateDuration(activeSession.checkIn)}
            </Text>
            {isOnBreak && (
              <Text style={styles.breakDurationText}>
                Break Duration: {calculateDuration(currentBreak?.startTime)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.noSessionText}>No Active Session</Text>
        )}
        {activeSession && renderBreakButtons()}
      </View>
    </View>
  );

  // Enhanced break buttons with better UX
  const renderBreakButtons = () => {
    if (!activeSession || loading) return null;

    if (isOnBreak) {
      return (
        <TouchableOpacity
          style={[styles.breakButton, styles.endBreakButton]}
          onPress={handleEndBreak}
        >
          <Ionicons name="return-up-back" size={24} color="#fff" />
          <Text style={styles.buttonText}>Return from Break</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.breakButtonsContainer}>
        <TouchableOpacity
          style={[styles.breakButton, styles.paidBreakButton]}
          onPress={() => handleStartBreak(true)}
        >
          <Ionicons name="cafe" size={24} color="#fff" />
          <Text style={styles.buttonText}>Paid Break</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.breakButton, styles.unpaidBreakButton]}
          onPress={() => handleStartBreak(false)}
        >
          <Ionicons name="cafe-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Unpaid Break</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Modify the log card to show breaks
  const renderLogCard = (log) => (
    <View key={log.id} style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logTime}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <Text style={styles.logTimeText}>
            {formatTime(log.checkIn)}
          </Text>
          {log.checkOut && (
            <>
              <Ionicons name="arrow-forward" size={20} color="#666" />
              <Text style={styles.logTimeText}>
                {formatTime(log.checkOut)}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
        </TouchableOpacity>
      </View>
      {log.breaks?.length > 0 && (
        <View style={styles.breaksContainer}>
          {log.breaks.map(breakItem => (
            <View key={breakItem.id} style={styles.breakItem}>
              <Ionicons 
                name="cafe" 
                size={16} 
                color={breakItem.isPaid ? "#4c669f" : "#666"} 
              />
              <Text style={styles.breakTimeText}>
                {formatTime(breakItem.startTime)} - {breakItem.endTime ? formatTime(breakItem.endTime) : 'Ongoing'}
                {breakItem.isPaid ? ' (Paid)' : ' (Unpaid)'}
              </Text>
            </View>
          ))}
        </View>
      )}
      {log.checkOut && (
        <Text style={styles.duration}>
          Duration: {((log.checkOut - log.checkIn) / (1000 * 60 * 60)).toFixed(2)}h
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      <View style={styles.headerContent}>
        <Text style={styles.greeting}>
          Hello, {user?.displayName || 'User'}! 👋
        </Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Main content in ScrollView */}
      <ScrollView 
        style={styles.mainContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderStatusCard()}

        {/* Check In / Out Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            activeSession ? styles.checkOutButton : styles.checkInButton,
            loading && styles.disabledButton
          ]}
          onPress={activeSession ? handleCheckOut : handleCheckIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons 
                name={activeSession ? "log-out-outline" : "log-in-outline"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.buttonText}>
                {activeSession ? 'Check Out' : 'Check In'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Break Suggestion - More compact */}
        {breakSuggestion && activeSession && (
          <View style={styles.breakSuggestion}>
            <Ionicons name="cafe-outline" size={20} color="#4c669f" />
            <Text style={styles.breakText}>{breakSuggestion}</Text>
          </View>
        )}

        {/* Today's Sessions */}
        <View style={styles.todaySection}>
          <Text style={styles.sectionTitle}>Today's Sessions</Text>
          {todayLogs.length > 0 ? (
            todayLogs.map(renderLogCard)
          ) : (
            <Text style={styles.noLogsText}>No sessions logged for today.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  customHeader: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  headerContent: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  statusCard: {
    margin: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    color: '#333',
  },
  statusContent: {
    alignItems: 'center',
  },
  activeSessionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4c669f',
  },
  timeText: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  durationText: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    fontWeight: '500',
  },
  noSessionText: {
    fontSize: 18,
    color: '#666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkInButton: {
    backgroundColor: '#4c669f',
  },
  checkOutButton: {
    backgroundColor: '#ff3b30',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  todaySection: {
    marginHorizontal: 20,
    marginBottom: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  logsList: {
    flex: 1,
  },
  logCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTimeText: {
    fontSize: 16,
    color: '#333',
    marginHorizontal: 5,
  },
  duration: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  noLogsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  breakSuggestion: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  breakText: {
    flex: 1,
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
    lineHeight: 18,
  },
  breakButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  breakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  paidBreakButton: {
    backgroundColor: '#4c669f',
    flex: 1,
  },
  unpaidBreakButton: {
    backgroundColor: '#666',
    flex: 1,
  },
  endBreakButton: {
    backgroundColor: '#FF9800',
  },
  breaksContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  breakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  breakTimeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusBreak: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  breakDurationText: {
    fontSize: 16,
    color: '#FF9800',
    marginTop: 5,
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
  },
});

export default DashboardScreen;
