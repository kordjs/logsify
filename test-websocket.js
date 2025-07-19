#!/usr/bin/env node

// Simple WebSocket test script for Logsify
const WebSocket = require('ws');
const mongoose = require('mongoose');

// Mock user and token creation for testing
async function setupTestData() {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/logsify');
    
    // Define schemas
    const userSchema = new mongoose.Schema({
        githubId: String,
        username: String,
        name: String,
        email: String,
        avatar: String,
        preferences: Object,
        isActive: { type: Boolean, default: true },
        loginCount: { type: Number, default: 0 }
    }, { timestamps: true });
    
    const tokenSchema = new mongoose.Schema({
        userId: String,
        token: String,
        label: String,
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });
    
    const User = mongoose.model('User', userSchema);
    const ApiToken = mongoose.model('ApiToken', tokenSchema);
    
    // Create test user if not exists
    let user = await User.findOne({ username: 'test-user' });
    if (!user) {
        console.log('👤 Creating test user...');
        user = await User.create({
            githubId: 'test123',
            username: 'test-user',
            name: 'Test User',
            email: 'test@example.com',
            preferences: { theme: 'dark' },
            isActive: true,
            loginCount: 1
        });
    }
    
    // Create test token if not exists
    let token = await ApiToken.findOne({ label: 'test-websocket-token' });
    if (!token) {
        console.log('🔑 Creating test API token...');
        token = await ApiToken.create({
            userId: user._id,
            token: 'logs_test123456789abcdef',
            label: 'test-websocket-token',
            isActive: true
        });
    }
    
    console.log('✅ Test data ready:', {
        userId: user._id,
        token: token.token,
        label: token.label
    });
    
    return { user, token };
}

// Test WebSocket connection
async function testWebSocket(token) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws?token=${token.token}`);
        
        ws.on('open', function open() {
            console.log('🔌 WebSocket connected successfully!');
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data.toString());
            console.log('📨 Received:', response);
            
            if (response.status === 'connected') {
                console.log('✅ Connection established, sending test logs...');
                
                // Send test log data
                const testLogs = [
                    {
                        level: 'info',
                        namespace: 'websocket-test',
                        message: 'WebSocket test log message 1',
                        metadata: { testId: 1, timestamp: new Date().toISOString() }
                    },
                    {
                        level: 'warn',
                        namespace: 'websocket-test',
                        message: 'WebSocket test log message 2',
                        metadata: { testId: 2, type: 'warning' }
                    },
                    {
                        level: 'error',
                        namespace: 'websocket-test',
                        message: 'WebSocket test log message 3',
                        metadata: { testId: 3, errorCode: 500 }
                    }
                ];
                
                ws.send(JSON.stringify(testLogs));
            } else if (response.status === 'ok') {
                console.log(`🎉 SUCCESS! Processed ${response.count} logs successfully`);
                ws.close();
                resolve(response);
            } else if (response.error) {
                console.error('❌ Error:', response.error);
                ws.close();
                reject(new Error(response.error));
            }
        });
        
        ws.on('close', function close(code, reason) {
            console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
            if (code === 4001) {
                reject(new Error('Authentication failed'));
            }
        });
        
        ws.on('error', function error(err) {
            console.error('🚨 WebSocket error:', err);
            reject(err);
        });
    });
}

// Test invalid token
async function testInvalidToken() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Testing invalid token authentication...');
        const ws = new WebSocket('ws://localhost:3000/ws?token=invalid_token');
        
        ws.on('close', function close(code, reason) {
            if (code === 4001) {
                console.log('✅ Invalid token correctly rejected with code 4001');
                resolve();
            } else {
                reject(new Error(`Unexpected close code: ${code}`));
            }
        });
        
        ws.on('error', function error(err) {
            reject(err);
        });
    });
}

// Run tests
async function runTests() {
    try {
        console.log('🚀 Starting WebSocket tests...\n');
        
        // Setup test data
        const { user, token } = await setupTestData();
        
        // Test 1: Invalid token
        await testInvalidToken();
        
        // Test 2: Valid token and log sending
        console.log('\n🔐 Testing valid token authentication...');
        await testWebSocket(token);
        
        console.log('\n🎉 All tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔗 MongoDB disconnected');
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { setupTestData, testWebSocket, testInvalidToken, runTests };