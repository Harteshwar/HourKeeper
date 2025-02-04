import React, { useState, useContext, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  Platform,
  Modal,
  ScrollView,
  Dimensions,
  RefreshControl,
  TouchableWithoutFeedback,
  SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase/config';
import { AuthContext } from '../context/AuthContext';
import { calculateDuration } from '../utils/timeUtils';
import AIInsights from '../components/AIInsights';

const { width } = Dimensions.get('window');

const ReportScreen = () => {
  const { user } = useContext(AuthContext);
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to last 7 days
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [toDate, setToDate] = useState(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalHours: 0,
    totalBreakHours: 0,
    averageHoursPerDay: 0,
    daysWorked: 0,
    longestDay: 0,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateType, setDateType] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCheckIn, setEditCheckIn] = useState(new Date());
  const [editCheckOut, setEditCheckOut] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'checkIn' or 'checkOut'
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewDatePicker, setShowNewDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState(null);
  const [newLog, setNewLog] = useState({
    checkIn: new Date(),
    checkOut: new Date(),
  });

  const presetRanges = [
    { label: 'Today', days: 0 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 15 Days', days: 15 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 }
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports().finally(() => setRefreshing(false));
  }, [fromDate, toDate]);

  const fetchReports = async (start = fromDate, end = toDate) => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await db.collection('timeLogs')
        .where('userId', '==', user.uid)
        .where('checkIn', '>=', start)
        .where('checkIn', '<=', end)
        .orderBy('checkIn', 'desc')
        .get();

      const logsData = [];
      let totalTime = 0;
      let totalBreakTime = 0;
      let daysMap = new Map();
      let longestDay = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const logData = {
          id: doc.id,
          ...data,
          checkIn: data.checkIn.toDate(),
          checkOut: data.checkOut?.toDate()
        };

        // Fetch breaks for this log
        const breaksSnapshot = await db
          .collection('breaks')
          .where('timeLogId', '==', doc.id)
          .where('userId', '==', user.uid)
          .orderBy('startTime', 'asc')
          .get();

        const breaks = breaksSnapshot.docs.map(breakDoc => ({
          id: breakDoc.id,
          ...breakDoc.data(),
          startTime: breakDoc.data().startTime.toDate(),
          endTime: breakDoc.data().endTime?.toDate()
        }));

        logData.breaks = breaks;

        if (logData.checkOut) {
          let breakDuration = 0;
          breaks.forEach(breakItem => {
            if (breakItem.endTime && !breakItem.isPaid) {
              breakDuration += (breakItem.endTime - breakItem.startTime) / (1000 * 60 * 60);
            }
          });

          // Calculate duration in hours
          const totalDuration = (logData.checkOut - logData.checkIn) / (1000 * 60 * 60);
          const netDuration = totalDuration - breakDuration;
          
          totalTime += netDuration;
          totalBreakTime += breakDuration;

          // Track daily totals
          const dateKey = logData.checkIn.toDateString();
          const currentDayTotal = daysMap.get(dateKey) || 0;
          const newDayTotal = currentDayTotal + netDuration;
          daysMap.set(dateKey, newDayTotal);
          longestDay = Math.max(longestDay, newDayTotal);

          // Add duration to log data for display
          logData.duration = netDuration;
          logData.breakDuration = breakDuration;
        }

        logsData.push(logData);
      }

      setLogs(logsData);
      setStats({
        totalHours: totalTime.toFixed(2),
        totalBreakHours: totalBreakTime.toFixed(2),
        averageHoursPerDay: (totalTime / Math.max(1, daysMap.size)).toFixed(2),
        daysWorked: daysMap.size,
        longestDay: longestDay.toFixed(2)
      });

    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to fetch reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setPresetRange = (days) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    setFromDate(start);
    setToDate(end);
    fetchReports(start, end);
  };

  const showDateSelection = useCallback((type) => {
    setDateType(type);
    setShowDatePicker(true);
  }, []);

  const onDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      if (dateType === 'from') {
        // Set to start of day
        selectedDate.setHours(0, 0, 0, 0);
        // Ensure 'to' date isn't before 'from' date
        if (selectedDate > toDate) {
          setToDate(selectedDate);
        }
        setFromDate(selectedDate);
      } else {
        // Set to end of day
        selectedDate.setHours(23, 59, 59, 999);
        // Ensure 'to' date isn't before 'from' date
        if (selectedDate >= fromDate) {
          setToDate(selectedDate);
        } else {
          Alert.alert('Invalid Date', 'End date cannot be before start date');
        }
      }
    }
  }, [dateType, fromDate, toDate]);

  const handleEditLog = (log) => {
    setEditingLog(log);
    setEditCheckIn(log.checkIn);
    setEditCheckOut(log.checkOut || new Date());
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;

    try {
      await db.collection('timeLogs').doc(editingLog.id).update({
        checkIn: editCheckIn,
        checkOut: editCheckOut,
        updatedAt: new Date()
      });

      setShowEditModal(false);
      Alert.alert('Success', 'Log updated successfully');
      fetchReports(); // Refresh the logs
    } catch (error) {
      Alert.alert('Error', 'Failed to update log');
    }
  };

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
              // Create audit record before deletion
              const logToDelete = logs.find(log => log.id === logId);
              await db.collection('timeLogsAudit').add({
                logId: logId,
                userId: user.uid,
                action: 'delete',
                deletedAt: new Date(),
                deletedBy: user.uid,
                logData: logToDelete // Store the log data for audit
              });

              // Delete the log
              await db.collection('timeLogs').doc(logId).delete();
              
              // Refresh the logs
              fetchReports();
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

  const handleDatePickerChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowNewDatePicker(false);
    }
    
    if (selectedDate) {
      // Normalize seconds to 0
      selectedDate.setSeconds(0, 0);
      
      if (datePickerField === 'checkIn') {
        if (selectedDate > newLog.checkOut) {
          setNewLog(prev => ({
            checkIn: selectedDate,
            checkOut: selectedDate
          }));
        } else {
          setNewLog(prev => ({
            ...prev,
            checkIn: selectedDate
          }));
        }
      } else {
        if (selectedDate < newLog.checkIn) {
          Alert.alert('Invalid Time', 'Check-out time must be after check-in time');
          return;
        }
        setNewLog(prev => ({
          ...prev,
          checkOut: selectedDate
        }));
      }
    }
  }, [datePickerField, newLog]);

  const openDatePicker = useCallback((field) => {
    setDatePickerField(field);
    setShowNewDatePicker(true);
  }, []);

  const handleAddManualLog = async () => {
    if (!user) return;

    try {
      if (newLog.checkOut <= newLog.checkIn) {
        Alert.alert('Error', 'Check-out time must be after check-in time');
        return;
      }

      setLoading(true);
      await db.collection('timeLogs').add({
        userId: user.uid,
        checkIn: newLog.checkIn,
        checkOut: newLog.checkOut,
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: true
      });

      setShowAddModal(false);
      Alert.alert('Success', 'Time log added successfully');
      fetchReports(); // Refresh the logs
    } catch (error) {
      console.error('Add manual log error:', error);
      Alert.alert('Error', 'Failed to add time log');
    } finally {
      setLoading(false);
    }
  };

  const renderEditModal = () => {
    if (!showEditModal) return null;

    return (
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Time Log</Text>
            
            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => {
                setEditingField('checkIn');
                setShowEditDatePicker(true);
              }}
            >
              <Ionicons name="time-outline" size={24} color="#4c669f" />
              <Text style={styles.timePickerButtonText}>
                Check In: {editCheckIn.toLocaleTimeString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => {
                setEditingField('checkOut');
                setShowEditDatePicker(true);
              }}
            >
              <Ionicons name="time-outline" size={24} color="#4c669f" />
              <Text style={styles.timePickerButtonText}>
                Check Out: {editCheckOut.toLocaleTimeString()}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderLogCard = (log) => (
    <View key={log.id} style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={styles.logDate}>
          {log.checkIn.toLocaleDateString()}
        </Text>
        <View style={styles.logActions}>
          <TouchableOpacity
            onPress={() => handleEditLog(log)}
            style={styles.editButton}
          >
            <Ionicons name="pencil-outline" size={20} color="#4c669f" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteLog(log.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={20} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.logTime}>
        <Ionicons name="time-outline" size={20} color="#4c669f" />
        <Text style={styles.logTimeText}>
          {log.checkIn.toLocaleTimeString()} - {log.checkOut ? log.checkOut.toLocaleTimeString() : 'In Progress'}
        </Text>
      </View>

      {log.breaks?.length > 0 && (
        <View style={styles.breaksContainer}>
          <Text style={styles.breaksSummary}>Breaks:</Text>
          {log.breaks.map(breakItem => (
            <View key={breakItem.id} style={styles.breakItem}>
              <Ionicons 
                name={breakItem.isPaid ? "cafe" : "cafe-outline"} 
                size={16} 
                color={breakItem.isPaid ? "#4c669f" : "#666"} 
              />
              <Text style={styles.breakTimeText}>
                {breakItem.startTime.toLocaleTimeString()} - 
                {breakItem.endTime ? breakItem.endTime.toLocaleTimeString() : 'Ongoing'}
                {breakItem.isPaid ? ' (Paid)' : ' (Unpaid)'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {log.checkOut && (
        <>
          <Text style={styles.duration}>
            Total Duration: {((log.checkOut - log.checkIn) / (1000 * 60 * 60)).toFixed(2)} hrs
          </Text>
          {log.breaks?.some(b => !b.isPaid) && (
            <Text style={styles.netDuration}>
              Net Working Hours: {calculateNetDuration(log)} hrs
            </Text>
          )}
        </>
      )}
    </View>
  );

  const calculateNetDuration = (log) => {
    if (!log.checkOut) return 0;
    
    const totalDuration = (log.checkOut - log.checkIn) / (1000 * 60 * 60);
    const unpaidBreakDuration = log.breaks?.reduce((total, breakItem) => {
      if (breakItem.endTime && !breakItem.isPaid) {
        return total + (breakItem.endTime - breakItem.startTime) / (1000 * 60 * 60);
      }
      return total;
    }, 0) || 0;

    return (totalDuration - unpaidBreakDuration).toFixed(2);
  };

  const renderDateTimePicker = () => {
    if (!showNewDatePicker) return null;

    return (
      <DateTimePicker
        value={datePickerField === 'checkIn' ? newLog.checkIn : newLog.checkOut}
        mode="datetime"
        is24Hour={false}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleDatePickerChange}
        minimumDate={datePickerField === 'checkOut' ? newLog.checkIn : undefined}
      />
    );
  };

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Manual Time Log</Text>
          
          <TouchableOpacity 
            style={styles.timePickerButton}
            onPress={() => {
              setDatePickerField('checkIn');
              setShowNewDatePicker(true);
            }}
          >
            <Ionicons name="calendar-outline" size={24} color="#4c669f" />
            <Text style={styles.timePickerButtonText}>
              Check In: {newLog.checkIn.toLocaleString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.timePickerButton}
            onPress={() => {
              setDatePickerField('checkOut');
              setShowNewDatePicker(true);
            }}
          >
            <Ionicons name="calendar-outline" size={24} color="#4c669f" />
            <Text style={styles.timePickerButtonText}>
              Check Out: {newLog.checkOut.toLocaleString()}
            </Text>
          </TouchableOpacity>

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowAddModal(false);
                setShowNewDatePicker(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleAddManualLog}
            >
              <Text style={styles.saveButtonText}>Add Log</Text>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'ios' && renderDateTimePicker()}
        </View>
      </View>
    </Modal>
  );

  const renderDatePicker = () => {
    if (!showDatePicker) return null;

    return (
      <DateTimePicker
        value={dateType === 'from' ? fromDate : toDate}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={onDateChange}
        maximumDate={dateType === 'from' ? new Date() : undefined}
        minimumDate={dateType === 'to' ? fromDate : undefined}
      />
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    presetContainer: {
      paddingVertical: 15,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    presetButton: {
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 8,
      backgroundColor: '#f5f5f5',
      marginRight: 10,
    },
    presetButtonText: {
      color: '#4c669f',
      fontSize: 14,
      fontWeight: '600',
    },
    dateContainer: {
      padding: 15,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    dateButtonText: {
      color: '#333',
      fontSize: 16,
      marginLeft: 10,
    },
    generateButton: {
      backgroundColor: '#4c669f',
      flexDirection: 'row',
      height: 50,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
    },
    buttonIcon: {
      marginRight: 8,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 15,
      justifyContent: 'space-between',
    },
    statCard: {
      width: (width - 45) / 2,
      backgroundColor: '#f5f5f5',
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#4c669f',
    },
    statLabel: {
      fontSize: 14,
      color: '#666',
      marginTop: 5,
    },
    logsContainer: {
      padding: 15,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#4c669f',
      marginBottom: 15,
    },
    logCard: {
      backgroundColor: '#fff',
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    logDate: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
    },
    logActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    editButton: {
      padding: 5,
      marginRight: 10,
    },
    deleteButton: {
      padding: 5,
    },
    logTime: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logTimeText: {
      fontSize: 16,
      color: '#333',
      marginLeft: 8,
    },
    duration: {
      fontSize: 14,
      color: '#666',
      marginTop: 8,
    },
    noLogsText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      marginTop: 20,
    },
    loader: {
      marginVertical: 20,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: '#fff',
      borderRadius: 15,
      padding: 20,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#4c669f',
      marginBottom: 20,
      textAlign: 'center',
    },
    timePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
    },
    timePickerButtonText: {
      marginLeft: 10,
      fontSize: 16,
      color: '#333',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginHorizontal: 5,
    },
    cancelButton: {
      backgroundColor: '#f5f5f5',
    },
    saveButton: {
      backgroundColor: '#4c669f',
    },
    cancelButtonText: {
      color: '#666',
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    dateRangeInfo: {
      backgroundColor: '#f5f5f5',
      padding: 10,
      marginHorizontal: 15,
      marginTop: 15,
      borderRadius: 8,
    },
    dateRangeText: {
      color: '#666',
      fontSize: 14,
      textAlign: 'center',
    },
    insightsContainer: {
      backgroundColor: '#fff',
      margin: 15,
      padding: 20,
      borderRadius: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    insightsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    insightsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#4c669f',
      marginLeft: 10,
    },
    breaksContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#eee',
    },
    breaksSummary: {
      fontSize: 14,
      color: '#666',
      fontWeight: '500',
      marginBottom: 5,
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
    netDuration: {
      fontSize: 14,
      color: '#4c669f',
      marginTop: 4,
      fontWeight: '500',
    },
    addLogButton: {
      backgroundColor: '#4CAF50',
      flexDirection: 'row',
      height: 50,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
    },
    datePickerModal: {
      backgroundColor: 'white',
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 20,
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    datePickerCancel: {
      color: '#666',
      fontSize: 16,
    },
    datePickerDone: {
      color: '#4c669f',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.dateRangeInfo}>
          <Text style={styles.dateRangeText}>
            Showing data from {fromDate.toLocaleDateString()} to {toDate.toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.presetContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
          >
            {presetRanges.map((range, index) => (
              <TouchableOpacity
                key={index}
                style={styles.presetButton}
                onPress={() => setPresetRange(range.days)}
              >
                <Text style={styles.presetButtonText}>{range.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.dateContainer}>
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={() => showDateSelection('from')}
          >
            <Ionicons name="calendar-outline" size={24} color="#4c669f" />
            <Text style={styles.dateButtonText}>
              From: {fromDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={() => showDateSelection('to')}
          >
            <Ionicons name="calendar-outline" size={24} color="#4c669f" />
            <Text style={styles.dateButtonText}>
              To: {toDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.generateButton}
            onPress={() => fetchReports()}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.generateButtonText}>Generate Report</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.addLogButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.generateButtonText}>Add Manual Log</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size={36} color="#4c669f" style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalHours}</Text>
                <Text style={styles.statLabel}>Total Hours</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalBreakHours}</Text>
                <Text style={styles.statLabel}>Total Break Hours</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.averageHoursPerDay}</Text>
                <Text style={styles.statLabel}>Avg Hours/Day</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.daysWorked}</Text>
                <Text style={styles.statLabel}>Days Worked</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.longestDay}</Text>
                <Text style={styles.statLabel}>Longest Day</Text>
              </View>
            </View>

            <View style={styles.logsContainer}>
              <Text style={styles.sectionTitle}>Time Logs</Text>
              {logs.length > 0 ? (
                logs.map(renderLogCard)
              ) : (
                <Text style={styles.noLogsText}>No time logs found for selected period</Text>
              )}
            </View>

            {logs.length > 0 && (
              <View style={styles.insightsContainer}>
                <View style={styles.insightsHeader}>
                  <Ionicons name="bulb-outline" size={24} color="#4c669f" />
                  <Text style={styles.insightsTitle}>AI Insights</Text>
                </View>
                <AIInsights logs={logs} />
              </View>
            )}
          </>
        )}

        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              {renderDatePicker()}
            </View>
          </Modal>
        ) : (
          renderDatePicker()
        )}

        {renderEditModal()}
        
        {showEditDatePicker && (
          <DateTimePicker
            value={editingField === 'checkIn' ? editCheckIn : editCheckOut}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowEditDatePicker(false);
              if (selectedDate) {
                if (editingField === 'checkIn') {
                  setEditCheckIn(selectedDate);
                } else {
                  setEditCheckOut(selectedDate);
                }
              }
            }}
          />
        )}

        {renderAddModal()}
        {Platform.OS === 'android' && renderDateTimePicker()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportScreen;
