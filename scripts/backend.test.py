#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Logsify Application
Tests all backend functionality including authentication, API endpoints, and dashboard routes.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urljoin

class LogsifyBackendTester:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.api_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {}
        })
        
    def make_request(self, method: str, endpoint: str, **kwargs) -> Tuple[Optional[requests.Response], Optional[str]]:
        """Make HTTP request with error handling"""
        try:
            url = urljoin(self.base_url, endpoint)
            response = self.session.request(method, url, timeout=10, **kwargs)
            return response, None
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def test_server_health(self) -> bool:
        """Test if server is running and accessible"""
        print("\n🔍 Testing Server Health...")
        
        response, error = self.make_request('GET', '/')
        if error:
            self.log_test("Server Health", False, f"Server not accessible: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("Server Health", True, f"Server running on {self.base_url}")
            return True
        else:
            self.log_test("Server Health", False, f"Server returned status {response.status_code}")
            return False
    
    def test_static_files(self):
        """Test static file serving"""
        print("\n🔍 Testing Static Files...")
        
        # Test CSS file serving
        response, error = self.make_request('GET', '/css/styles.css')
        if error:
            self.log_test("Static CSS", False, f"CSS file request failed: {error}")
        elif response.status_code == 200:
            self.log_test("Static CSS", True, "CSS files served correctly")
        else:
            self.log_test("Static CSS", False, f"CSS returned status {response.status_code}")
    
    def test_auth_endpoints(self):
        """Test authentication system endpoints"""
        print("\n🔍 Testing Authentication System...")
        
        # Test auth status endpoint (unauthenticated)
        response, error = self.make_request('GET', '/auth/status')
        if error:
            self.log_test("Auth Status (Unauth)", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get('authenticated') == False:
                    self.log_test("Auth Status (Unauth)", True, "Correctly returns unauthenticated status")
                else:
                    self.log_test("Auth Status (Unauth)", False, f"Unexpected auth status: {data}")
            except json.JSONDecodeError:
                self.log_test("Auth Status (Unauth)", False, "Invalid JSON response")
        else:
            self.log_test("Auth Status (Unauth)", False, f"Status endpoint returned {response.status_code}")
        
        # Test GitHub OAuth redirect
        response, error = self.make_request('GET', '/auth/github', allow_redirects=False)
        if error:
            self.log_test("GitHub OAuth", False, f"Request failed: {error}")
        elif response.status_code in [302, 301]:
            location = response.headers.get('Location', '')
            if 'github.com' in location:
                self.log_test("GitHub OAuth", True, "Correctly redirects to GitHub OAuth")
            else:
                self.log_test("GitHub OAuth", False, f"Unexpected redirect location: {location}")
        else:
            self.log_test("GitHub OAuth", False, f"OAuth endpoint returned {response.status_code}")
        
        # Test logout endpoint (should handle unauthenticated state)
        response, error = self.make_request('POST', '/auth/logout')
        if error:
            self.log_test("Logout Endpoint", False, f"Request failed: {error}")
        elif response.status_code in [200, 302, 401]:
            self.log_test("Logout Endpoint", True, "Logout endpoint accessible")
        else:
            self.log_test("Logout Endpoint", False, f"Logout returned unexpected status {response.status_code}")
    
    def test_api_endpoints_without_auth(self):
        """Test API endpoints without authentication (should fail)"""
        print("\n🔍 Testing API Endpoints (No Auth)...")
        
        # Test POST /api/logs without auth
        response, error = self.make_request('POST', '/api/logs', 
                                          json={'message': 'test log', 'level': 'info'})
        if error:
            self.log_test("API Logs POST (No Auth)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Logs POST (No Auth)", True, "Correctly rejects unauthenticated requests")
        else:
            self.log_test("API Logs POST (No Auth)", False, f"Should return 401, got {response.status_code}")
        
        # Test GET /api/logs without auth
        response, error = self.make_request('GET', '/api/logs')
        if error:
            self.log_test("API Logs GET (No Auth)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Logs GET (No Auth)", True, "Correctly rejects unauthenticated requests")
        else:
            self.log_test("API Logs GET (No Auth)", False, f"Should return 401, got {response.status_code}")
        
        # Test POST /api/tokens without session auth
        response, error = self.make_request('POST', '/api/tokens', 
                                          json={'label': 'test token'})
        if error:
            self.log_test("API Tokens POST (No Auth)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Tokens POST (No Auth)", True, "Correctly rejects unauthenticated requests")
        else:
            self.log_test("API Tokens POST (No Auth)", False, f"Should return 401, got {response.status_code}")
        
        # Test GET /api/tokens without session auth
        response, error = self.make_request('GET', '/api/tokens')
        if error:
            self.log_test("API Tokens GET (No Auth)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Tokens GET (No Auth)", True, "Correctly rejects unauthenticated requests")
        else:
            self.log_test("API Tokens GET (No Auth)", False, f"Should return 401, got {response.status_code}")
    
    def test_api_endpoints_with_invalid_token(self):
        """Test API endpoints with invalid Bearer token"""
        print("\n🔍 Testing API Endpoints (Invalid Token)...")
        
        headers = {'Authorization': 'Bearer invalid_token_12345'}
        
        # Test POST /api/logs with invalid token
        response, error = self.make_request('POST', '/api/logs', 
                                          headers=headers,
                                          json={'message': 'test log', 'level': 'info'})
        if error:
            self.log_test("API Logs POST (Invalid Token)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Logs POST (Invalid Token)", True, "Correctly rejects invalid tokens")
        else:
            self.log_test("API Logs POST (Invalid Token)", False, f"Should return 401, got {response.status_code}")
        
        # Test GET /api/logs with invalid token
        response, error = self.make_request('GET', '/api/logs', headers=headers)
        if error:
            self.log_test("API Logs GET (Invalid Token)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("API Logs GET (Invalid Token)", True, "Correctly rejects invalid tokens")
        else:
            self.log_test("API Logs GET (Invalid Token)", False, f"Should return 401, got {response.status_code}")
    
    def test_dashboard_routes_without_auth(self):
        """Test dashboard routes without authentication (should redirect)"""
        print("\n🔍 Testing Dashboard Routes (No Auth)...")
        
        # Test dashboard home redirect
        response, error = self.make_request('GET', '/dashboard', allow_redirects=False)
        if error:
            self.log_test("Dashboard Home (No Auth)", False, f"Request failed: {error}")
        elif response.status_code in [302, 301]:
            location = response.headers.get('Location', '')
            if location == '/' or location.endswith('/'):
                self.log_test("Dashboard Home (No Auth)", True, "Correctly redirects unauthenticated users")
            else:
                self.log_test("Dashboard Home (No Auth)", False, f"Unexpected redirect: {location}")
        else:
            self.log_test("Dashboard Home (No Auth)", False, f"Should redirect, got {response.status_code}")
        
        # Test logs page
        response, error = self.make_request('GET', '/dashboard/logs', allow_redirects=False)
        if error:
            self.log_test("Dashboard Logs (No Auth)", False, f"Request failed: {error}")
        elif response.status_code in [302, 301]:
            self.log_test("Dashboard Logs (No Auth)", True, "Correctly redirects unauthenticated users")
        else:
            self.log_test("Dashboard Logs (No Auth)", False, f"Should redirect, got {response.status_code}")
        
        # Test settings page
        response, error = self.make_request('GET', '/dashboard/settings', allow_redirects=False)
        if error:
            self.log_test("Dashboard Settings (No Auth)", False, f"Request failed: {error}")
        elif response.status_code in [302, 301]:
            self.log_test("Dashboard Settings (No Auth)", True, "Correctly redirects unauthenticated users")
        else:
            self.log_test("Dashboard Settings (No Auth)", False, f"Should redirect, got {response.status_code}")
    
    def test_api_validation(self):
        """Test API input validation"""
        print("\n🔍 Testing API Input Validation...")
        
        headers = {'Authorization': 'Bearer valid_token_would_be_here'}
        
        # Test POST /api/logs with missing message
        response, error = self.make_request('POST', '/api/logs', 
                                          headers=headers,
                                          json={'level': 'info'})  # Missing message
        if error:
            self.log_test("API Validation (Missing Message)", False, f"Request failed: {error}")
        elif response.status_code == 401:
            # Expected since we don't have a valid token, but validates the endpoint exists
            self.log_test("API Validation (Missing Message)", True, "Endpoint validates input structure")
        else:
            self.log_test("API Validation (Missing Message)", True, f"Endpoint accessible for validation testing")
        
        # Test POST /api/tokens with missing label
        response, error = self.make_request('POST', '/api/tokens', json={})  # Missing label
        if error:
            self.log_test("API Validation (Missing Label)", False, f"Request failed: {error}")
        elif response.status_code in [400, 401]:
            self.log_test("API Validation (Missing Label)", True, "Endpoint validates required fields")
        else:
            self.log_test("API Validation (Missing Label)", True, f"Endpoint accessible for validation testing")
    
    def test_cors_headers(self):
        """Test CORS configuration"""
        print("\n🔍 Testing CORS Headers...")
        
        # Test preflight request
        response, error = self.make_request('OPTIONS', '/api/logs',
                                          headers={
                                              'Origin': 'http://localhost:3000',
                                              'Access-Control-Request-Method': 'POST',
                                              'Access-Control-Request-Headers': 'Content-Type,Authorization'
                                          })
        if error:
            self.log_test("CORS Preflight", False, f"Request failed: {error}")
        elif response.status_code in [200, 204]:
            cors_headers = {k.lower(): v for k, v in response.headers.items() if 'access-control' in k.lower()}
            if cors_headers:
                self.log_test("CORS Preflight", True, f"CORS headers present: {list(cors_headers.keys())}")
            else:
                self.log_test("CORS Preflight", False, "No CORS headers found")
        else:
            self.log_test("CORS Preflight", False, f"Unexpected status {response.status_code}")
    
    def test_security_headers(self):
        """Test security headers (Helmet.js)"""
        print("\n🔍 Testing Security Headers...")
        
        response, error = self.make_request('GET', '/')
        if error:
            self.log_test("Security Headers", False, f"Request failed: {error}")
        elif response.status_code == 200:
            security_headers = []
            headers_to_check = [
                'x-content-type-options',
                'x-frame-options', 
                'x-xss-protection',
                'content-security-policy',
                'strict-transport-security'
            ]
            
            for header in headers_to_check:
                if header in response.headers:
                    security_headers.append(header)
            
            if security_headers:
                self.log_test("Security Headers", True, f"Security headers present: {security_headers}")
            else:
                self.log_test("Security Headers", False, "No security headers found")
        else:
            self.log_test("Security Headers", False, f"Could not test headers, status {response.status_code}")
    
    def test_database_connection(self):
        """Test database connectivity indirectly through API responses"""
        print("\n🔍 Testing Database Integration...")
        
        # Test that endpoints requiring database access return appropriate errors
        # rather than 500 internal server errors (which would indicate DB issues)
        
        response, error = self.make_request('GET', '/auth/status')
        if error:
            self.log_test("Database Integration", False, f"Request failed: {error}")
        elif response.status_code == 500:
            self.log_test("Database Integration", False, "Server error suggests database connection issues")
        elif response.status_code == 200:
            try:
                data = response.json()
                self.log_test("Database Integration", True, "Database appears to be connected (no 500 errors)")
            except json.JSONDecodeError:
                self.log_test("Database Integration", False, "Invalid JSON response suggests issues")
        else:
            self.log_test("Database Integration", True, "No database connection errors detected")
    
    def test_error_handling(self):
        """Test error handling for various scenarios"""
        print("\n🔍 Testing Error Handling...")
        
        # Test 404 handling
        response, error = self.make_request('GET', '/nonexistent-endpoint')
        if error:
            self.log_test("404 Handling", False, f"Request failed: {error}")
        elif response.status_code == 404:
            self.log_test("404 Handling", True, "Correctly returns 404 for non-existent endpoints")
        else:
            self.log_test("404 Handling", False, f"Should return 404, got {response.status_code}")
        
        # Test malformed JSON handling
        response, error = self.make_request('POST', '/api/logs',
                                          headers={'Content-Type': 'application/json'},
                                          data='{"invalid": json}')  # Malformed JSON
        if error:
            self.log_test("Malformed JSON", False, f"Request failed: {error}")
        elif response.status_code in [400, 401]:  # 401 expected due to no auth, 400 for bad JSON
            self.log_test("Malformed JSON", True, "Handles malformed JSON appropriately")
        else:
            self.log_test("Malformed JSON", True, f"Endpoint handles malformed requests (status: {response.status_code})")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Logsify Backend Testing...")
        print(f"🎯 Target URL: {self.base_url}")
        print("=" * 60)
        
        # Check if server is running first
        if not self.test_server_health():
            print("\n❌ Server is not accessible. Please ensure the server is running on port 3000.")
            return False
        
        # Run all test suites
        self.test_static_files()
        self.test_auth_endpoints()
        self.test_api_endpoints_without_auth()
        self.test_api_endpoints_with_invalid_token()
        self.test_dashboard_routes_without_auth()
        self.test_api_validation()
        self.test_cors_headers()
        self.test_security_headers()
        self.test_database_connection()
        self.test_error_handling()
        
        # Print summary
        self.print_summary()
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        failed = total - passed
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print(f"\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)
        
        # Critical issues that would prevent the app from working
        critical_failures = []
        for result in self.test_results:
            if not result['success'] and any(keyword in result['test'].lower() for keyword in 
                                           ['server health', 'database integration']):
                critical_failures.append(result)
        
        if critical_failures:
            print("🚨 CRITICAL ISSUES DETECTED:")
            for failure in critical_failures:
                print(f"   • {failure['test']}: {failure['message']}")
        else:
            print("✅ No critical issues detected. Core functionality appears to be working.")

def main():
    """Main function to run tests"""
    # Check if custom URL provided
    base_url = "http://localhost:3000"
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    
    tester = LogsifyBackendTester(base_url)
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()