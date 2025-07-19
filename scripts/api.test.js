const axios = require('axios');

// Test the API endpoints
async function testAPI() {
        const baseURL = 'http://localhost:3000';

        console.log('🧪 Testing API endpoints...\n');

        // Test 1: Try to create a log without authentication (should fail)
        try {
                console.log('1. Testing unauthenticated log creation...');
                const response = await axios.post(`${baseURL}/api/logs`, {
                        level: 'info',
                        namespace: 'test',
                        message: 'Test log message',
                        metadata: { test: true }
                });
                console.log('❌ Expected this to fail but it succeeded');
        } catch (error) {
                if (error.response?.status === 401) {
                        console.log('✅ Correctly rejected unauthenticated request');
                } else {
                        console.log('❌ Unexpected error:', error.message);
                }
        }

        // Test 2: Try to create a log with invalid token (should fail)
        try {
                console.log('\n2. Testing invalid token...');
                const response = await axios.post(
                        `${baseURL}/api/logs`,
                        {
                                level: 'info',
                                namespace: 'test',
                                message: 'Test log message',
                                metadata: { test: true }
                        },
                        {
                                headers: {
                                        Authorization: 'Bearer invalid-token'
                                }
                        }
                );
                console.log('❌ Expected this to fail but it succeeded');
        } catch (error) {
                if (error.response?.status === 401) {
                        console.log('✅ Correctly rejected invalid token');
                } else {
                        console.log('❌ Unexpected error:', error.message);
                }
        }

        // Test 3: Check if homepage loads
        try {
                console.log('\n3. Testing homepage...');
                const response = await axios.get(`${baseURL}/`);
                if (response.status === 200) {
                        console.log('✅ Homepage loads successfully');
                }
        } catch (error) {
                console.log('❌ Homepage failed to load:', error.message);
        }

        // Test 4: Check if dashboard redirects to login
        try {
                console.log('\n4. Testing dashboard redirect...');
                const response = await axios.get(`${baseURL}/dashboard`, {
                        maxRedirects: 0
                });
                console.log('❌ Expected redirect but got success');
        } catch (error) {
                if (error.response?.status === 302) {
                        console.log('✅ Dashboard correctly redirects when not authenticated');
                } else {
                        console.log('❌ Unexpected response:', error.message);
                }
        }

        console.log('\n🎉 API tests completed!');
}

testAPI().catch(console.error);
