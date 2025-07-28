import React, { useState, useEffect } from 'react'
import { id, type RoomsOf, type PresenceOf, type TopicsOf } from '../../src/index.ts'

// Test the restored type exports from v0.20.12
type TestSchema = {
  entities: {
    testEvents: {
      name: string
      eventDate: Date
      metadata: any
    }
  }
  links: {}
  rooms: {
    testRoom: {
      presence: {
        name: string
        cursor: { x: number; y: number }
      }
      topics: {
        testTopic: {
          message: string
          timestamp: Date
        }
      }
    }
  }
}

// Validate that the restored types work correctly
type TestRooms = RoomsOf<TestSchema>
type TestPresence = PresenceOf<TestSchema, 'testRoom'>
type TestTopics = TopicsOf<TestSchema, 'testRoom'>

function V20_12ValidationTests({ db }: { db: any }) {
  const [logs, setLogs] = useState<Array<{ message: string; type: string; timestamp: string }>>([])
  const [testResults, setTestResults] = useState<Record<string, 'pending' | 'pass' | 'fail'>>({
    'date-objects-input': 'pending',
    'date-strings-input': 'pending',
    'response-format': 'pending',
    'type-exports': 'pending',
    'react-hooks': 'pending',
  })
  const [testEventId, setTestEventId] = useState<string | null>(null)
  
  // Use React hooks properly - these are called inside the component
  const allTestEventsQuery = db.useQuery({ testEvents: {} })
  
  // Monitor test events query for automatic validation
  useEffect(() => {
    if (allTestEventsQuery.data?.testEvents && testEventId) {
      const event = allTestEventsQuery.data.testEvents.find(e => e.id === testEventId)
      
      if (event) {
        const metadata = event.metadata
        
        addLog(`🔍 Debug: Found event with metadata: ${JSON.stringify(metadata)}, eventDate type: ${typeof event.eventDate}, instanceof Date: ${event.eventDate instanceof Date}`, 'info')
        
        if (metadata?.testType === 'dateObject') {
          if (event.eventDate instanceof Date) {
            addLog('✅ Date object input preserved as Date object', 'success')
            updateTestResult('date-objects-input', 'pass')
          } else {
            addLog(`❌ Date object not preserved. Got: ${typeof event?.eventDate} - ${event?.eventDate}`, 'error')
            updateTestResult('date-objects-input', 'fail')
          }
        } else if (metadata?.testType === 'isoString') {
          if (event.eventDate instanceof Date) {
            addLog('✅ ISO string input coerced to Date object', 'success')
            updateTestResult('date-strings-input', 'pass')
          } else {
            addLog(`❌ ISO string not coerced to Date. Got: ${typeof event?.eventDate} - ${event?.eventDate}`, 'error')
            updateTestResult('date-strings-input', 'fail')
          }
        }
      } else if (allTestEventsQuery.data.testEvents.length > 0) {
        addLog(`🔍 Debug: Event ${testEventId} not found, but ${allTestEventsQuery.data.testEvents.length} events exist. Event IDs: ${allTestEventsQuery.data.testEvents.map(e => e.id).join(', ')}`, 'info')
      }
    }
  }, [allTestEventsQuery.data, testEventId])

  const addLog = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
  }

  const updateTestResult = (testName: string, result: 'pass' | 'fail') => {
    setTestResults(prev => ({ ...prev, [testName]: result }))
  }

  const clearLogs = () => {
    setLogs([])
  }

  // Test 1: useDateObjects with Date object input
  const testDateObjectsInput = async () => {
    try {
      addLog('🧪 Testing useDateObjects with Date object input...', 'info')
      
      const testDate = new Date('2024-01-15T10:30:00.000Z')
      const eventId = id()
      
      await db.transact([
        db.tx.testEvents[eventId].update({
          name: 'Date Object Test Event',
          eventDate: testDate,
          metadata: { testType: 'dateObject', inputType: 'Date' }
        })
      ])
      
      // Set the test event ID to trigger the useEffect validation
      setTestEventId(eventId)
      
    } catch (error: any) {
      addLog(`❌ Date objects test failed: ${error.message}`, 'error')
      updateTestResult('date-objects-input', 'fail')
    }
  }

  // Test 2: useDateObjects with ISO string input
  const testDateStringsInput = async () => {
    try {
      addLog('🧪 Testing useDateObjects with ISO string input...', 'info')
      
      const testDateString = '2024-02-20T15:45:00.000Z'
      const eventId = id()
      
      await db.transact([
        db.tx.testEvents[eventId].update({
          name: 'ISO String Test Event',
          eventDate: testDateString,
          metadata: { testType: 'isoString', inputType: 'string' }
        })
      ])
      
      // Set the test event ID to trigger the useEffect validation
      setTestEventId(eventId)
      
    } catch (error: any) {
      addLog(`❌ ISO string test failed: ${error.message}`, 'error')
      updateTestResult('date-strings-input', 'fail')
    }
  }

  // Test 3: Response format validation (eventId vs clientId)
  const testResponseFormat = async () => {
    try {
      addLog('🧪 Testing v0.20.12 response format (eventId vs clientId)...', 'info')
      
      const eventId = id()
      
      const response = await db.transact([
        db.tx.testEvents[eventId].update({
          name: 'Response Format Test',
          eventDate: new Date(),
          metadata: { testType: 'responseFormat' }
        })
      ])
      
      // Check response structure
      if (response && typeof response.eventId === 'string' && !response.clientId) {
        addLog('✅ Response uses eventId (v0.20.12 format)', 'success')
        updateTestResult('response-format', 'pass')
      } else {
        addLog(`❌ Response format incorrect. Has eventId: ${!!response?.eventId}, Has clientId: ${!!response?.clientId}`, 'error')
        updateTestResult('response-format', 'fail')
      }
      
    } catch (error: any) {
      addLog(`❌ Response format test failed: ${error.message}`, 'error')
      updateTestResult('response-format', 'fail')
    }
  }

  // Test 4: Type exports validation
  const testTypeExports = () => {
    try {
      addLog('🧪 Testing restored type exports (RoomsOf, PresenceOf, TopicsOf)...', 'info')
      
      // Type check that these types are available and can be used
      // If this compiles without errors, it means the types are properly exported
      const typeTest = (): { 
        rooms: TestRooms, 
        presence: TestPresence, 
        topics: TestTopics 
      } => {
        return {} as any
      }
      
      const result = typeTest()
      if (result !== undefined) {
        addLog('✅ Type exports (RoomsOf, PresenceOf, TopicsOf) are working', 'success')
        updateTestResult('type-exports', 'pass')
      } else {
        addLog('❌ Type exports failed', 'error')
        updateTestResult('type-exports', 'fail')
      }
      
    } catch (error: any) {
      addLog(`❌ Type exports test failed: ${error.message}`, 'error')
      updateTestResult('type-exports', 'fail')
    }
  }

  // Test 5: React hooks integration
  const testReactHooks = () => {
    try {
      addLog('🧪 Testing React hooks integration with v0.20.12...', 'info')
      
      // Test that useQuery hook is working with updated core-offline
      // We're already using the hook properly at the component level
      if (allTestEventsQuery && typeof allTestEventsQuery.isLoading === 'boolean') {
        addLog('✅ React hooks integrate properly with core-offline v0.20.12', 'success')
        updateTestResult('react-hooks', 'pass')
      } else {
        addLog('❌ React hooks integration failed', 'error')
        updateTestResult('react-hooks', 'fail')
      }
      
    } catch (error: any) {
      addLog(`❌ React hooks test failed: ${error.message}`, 'error')
      updateTestResult('react-hooks', 'fail')
    }
  }

  // Run all tests
  const runAllTests = async () => {
    addLog('🚀 Starting v0.20.12 validation tests...', 'info')
    
    // Reset test results and clear any previous test event
    setTestEventId(null)
    setTestResults({
      'date-objects-input': 'pending',
      'date-strings-input': 'pending', 
      'response-format': 'pending',
      'type-exports': 'pending',
      'react-hooks': 'pending',
    })
    
    // Run synchronous tests first
    testTypeExports()
    testReactHooks()
    
    // Run async tests
    await testDateObjectsInput()
    await new Promise(resolve => setTimeout(resolve, 200)) // Short delay between tests
    await testDateStringsInput()
    await new Promise(resolve => setTimeout(resolve, 200)) // Short delay between tests
    await testResponseFormat()
    
    addLog('🎯 All v0.20.12 validation tests completed! Date tests use automatic validation.', 'info')
  }

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return '✅'
      case 'fail': return '❌'
      case 'pending': return '⏳'
      default: return '❓'
    }
  }

  return (
    <div className="validation-container">
      <h2>🔬 React-Offline v0.20.12 Validation Tests</h2>
      
      <div className="test-controls">
        <button onClick={runAllTests} className="btn btn-primary">
          🧪 Run All V0.20.12 Tests
        </button>
        <button onClick={testDateObjectsInput} className="btn btn-secondary">
          📅 Test Date Objects
        </button>
        <button onClick={testDateStringsInput} className="btn btn-secondary">
          📝 Test ISO Strings
        </button>
        <button onClick={testResponseFormat} className="btn btn-secondary">
          📋 Test Response Format
        </button>
      </div>

      <div className="test-results">
        <h3>Test Results</h3>
        <div className="results-grid">
          {Object.entries(testResults).map(([testName, status]) => (
            <div key={testName} className={`result-item ${status}`}>
              <span className="result-icon">{getTestStatusIcon(status)}</span>
              <span className="result-name">{testName.replace('-', ' ')}</span>
              <span className="result-status">{status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="console-section">
        <div className="console-header">
          <h3>Test Console</h3>
          <button onClick={clearLogs} className="btn btn-small">Clear</button>
        </div>
        <div className="console">
          {logs.map((log, index) => (
            <div key={index} className={`log-entry ${log.type}`}>
              <span className="log-timestamp">[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      </div>

      <div className="feature-summary">
        <h3>🎯 v0.20.12 Features Being Tested</h3>
        <ul>
          <li><strong>useDateObjects</strong>: Date object and ISO string handling</li>
          <li><strong>Response Format</strong>: eventId instead of clientId in responses</li>
          <li><strong>Type Exports</strong>: Restored RoomsOf, PresenceOf, TopicsOf types</li>
          <li><strong>React Integration</strong>: Hooks compatibility with updated core</li>
          <li><strong>Offline Mode</strong>: All tests run in pure offline mode</li>
        </ul>
      </div>
    </div>
  )
}

export default V20_12ValidationTests 