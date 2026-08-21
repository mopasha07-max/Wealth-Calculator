#!/usr/bin/env python3
"""
Comprehensive Backend API Test for Net Worth Tracker
Tests all endpoints: Auth, Profile, Assets, Liabilities, Goals, Dashboard, CSV Export, Admin
"""

import requests
import json
import random
import string
from datetime import datetime

# Base URL from .env
BASE_URL = "https://014034f7-66d0-4356-b597-4070a5cceb94.preview.emergentagent.com/api"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_pass(test_name):
    print(f"✅ PASS: {test_name}")
    test_results["passed"].append(test_name)

def log_fail(test_name, reason):
    print(f"❌ FAIL: {test_name} - {reason}")
    test_results["failed"].append(f"{test_name}: {reason}")

def log_warning(test_name, reason):
    print(f"⚠️  WARNING: {test_name} - {reason}")
    test_results["warnings"].append(f"{test_name}: {reason}")

def generate_unique_email():
    """Generate unique email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"user+{random_str}@test.com"

# Global variables to store test data
regular_user_email = generate_unique_email()
regular_user_password = "TestPass123!"
regular_user_token = None
admin_token = None
created_asset_id = None
created_custom_asset_id = None
created_liability_id = None
created_goal_id = None

print("=" * 80)
print("NET WORTH TRACKER - BACKEND API TEST")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Test User Email: {regular_user_email}")
print("=" * 80)

# ============================================================================
# 1. AUTH TESTS
# ============================================================================
print("\n" + "=" * 80)
print("1. AUTH TESTS")
print("=" * 80)

# Test 1.1: Signup with NEW regular user
print("\n[Test 1.1] POST /auth/signup - New regular user")
try:
    response = requests.post(
        f"{BASE_URL}/auth/signup",
        json={
            "email": regular_user_email,
            "password": regular_user_password,
            "name": "Test User",
            "currency": "USD"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            regular_user_token = data["token"]
            user = data["user"]
            if user.get("role") == "user":
                log_pass("Auth - Signup regular user (role=user)")
            else:
                log_warning("Auth - Signup regular user", f"Expected role=user, got role={user.get('role')}")
        else:
            log_fail("Auth - Signup regular user", "Missing token or user in response")
    else:
        log_fail("Auth - Signup regular user", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Auth - Signup regular user", f"Exception: {str(e)}")

# Test 1.2: Signup with admin@networth.app (should be 409 or admin)
print("\n[Test 1.2] POST /auth/signup - admin@networth.app")
try:
    response = requests.post(
        f"{BASE_URL}/auth/signup",
        json={
            "email": "admin@networth.app",
            "password": "test1234",
            "name": "Admin User",
            "currency": "USD"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 409:
        log_pass("Auth - Signup admin@networth.app (409 already exists)")
    elif response.status_code == 200:
        data = response.json()
        if data.get("user", {}).get("role") == "admin":
            log_pass("Auth - Signup admin@networth.app (became admin)")
        else:
            log_fail("Auth - Signup admin@networth.app", "Expected admin role")
    else:
        log_fail("Auth - Signup admin@networth.app", f"Unexpected status {response.status_code}")
except Exception as e:
    log_fail("Auth - Signup admin@networth.app", f"Exception: {str(e)}")

# Test 1.3: Login with regular user
print("\n[Test 1.3] POST /auth/login - Regular user")
try:
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": regular_user_email,
            "password": regular_user_password
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            regular_user_token = data["token"]
            log_pass("Auth - Login regular user")
        else:
            log_fail("Auth - Login regular user", "Missing token or user")
    else:
        log_fail("Auth - Login regular user", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Auth - Login regular user", f"Exception: {str(e)}")

# Test 1.4: Login with wrong password
print("\n[Test 1.4] POST /auth/login - Wrong password")
try:
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": regular_user_email,
            "password": "WrongPassword123"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 401:
        log_pass("Auth - Login wrong password (401)")
    else:
        log_fail("Auth - Login wrong password", f"Expected 401, got {response.status_code}")
except Exception as e:
    log_fail("Auth - Login wrong password", f"Exception: {str(e)}")

# Test 1.5: GET /auth/me with token
print("\n[Test 1.5] GET /auth/me - With Bearer token")
try:
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "user" in data:
            log_pass("Auth - GET /me with token")
        else:
            log_fail("Auth - GET /me with token", "Missing user in response")
    else:
        log_fail("Auth - GET /me with token", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Auth - GET /me with token", f"Exception: {str(e)}")

# Test 1.6: GET /auth/me without token
print("\n[Test 1.6] GET /auth/me - Without token")
try:
    response = requests.get(
        f"{BASE_URL}/auth/me",
        timeout=10
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 401:
        log_pass("Auth - GET /me without token (401)")
    else:
        log_fail("Auth - GET /me without token", f"Expected 401, got {response.status_code}")
except Exception as e:
    log_fail("Auth - GET /me without token", f"Exception: {str(e)}")

# ============================================================================
# 2. PROFILE TESTS
# ============================================================================
print("\n" + "=" * 80)
print("2. PROFILE TESTS")
print("=" * 80)

# Test 2.1: Update profile (currency and name)
print("\n[Test 2.1] PUT /profile - Update currency and name")
try:
    response = requests.put(
        f"{BASE_URL}/profile",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        json={
            "currency": "INR",
            "name": "Updated Test User"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        user = data.get("user", {})
        if user.get("currency") == "INR" and user.get("name") == "Updated Test User":
            log_pass("Profile - Update currency and name")
        else:
            log_fail("Profile - Update", f"Currency={user.get('currency')}, Name={user.get('name')}")
    else:
        log_fail("Profile - Update", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Profile - Update", f"Exception: {str(e)}")

# ============================================================================
# 3. ASSETS CRUD TESTS
# ============================================================================
print("\n" + "=" * 80)
print("3. ASSETS CRUD TESTS")
print("=" * 80)

# Test 3.1: Create asset with default category
print("\n[Test 3.1] POST /assets - Create asset (Stocks)")
try:
    response = requests.post(
        f"{BASE_URL}/assets",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        json={
            "name": "Apple Stock",
            "category": "Stocks",
            "value": 10000,
            "notes": "AAPL shares"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "id" in data:
            created_asset_id = data["id"]
            log_pass("Assets - Create asset (Stocks)")
        else:
            log_fail("Assets - Create asset", "Missing id in response")
    else:
        log_fail("Assets - Create asset", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Assets - Create asset", f"Exception: {str(e)}")

# Test 3.2: Create asset with CUSTOM category
print("\n[Test 3.2] POST /assets - Create asset (Custom category)")
try:
    response = requests.post(
        f"{BASE_URL}/assets",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        json={
            "name": "Startup Investment",
            "category": "Angel Investments",
            "value": 5000,
            "notes": "Early stage startup"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "id" in data and data.get("category") == "Angel Investments":
            created_custom_asset_id = data["id"]
            log_pass("Assets - Create asset (Custom category)")
        else:
            log_fail("Assets - Create asset (Custom)", "Missing id or wrong category")
    else:
        log_fail("Assets - Create asset (Custom)", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Assets - Create asset (Custom)", f"Exception: {str(e)}")

# Test 3.3: GET all assets
print("\n[Test 3.3] GET /assets - List all assets")
try:
    response = requests.get(
        f"{BASE_URL}/assets",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list) and len(data) >= 2:
            log_pass("Assets - GET all assets")
        else:
            log_fail("Assets - GET all", f"Expected array with 2+ items, got {len(data) if isinstance(data, list) else 'not array'}")
    else:
        log_fail("Assets - GET all", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Assets - GET all", f"Exception: {str(e)}")

# Test 3.4: Update asset value
print("\n[Test 3.4] PUT /assets/{id} - Update value")
if created_asset_id:
    try:
        response = requests.put(
            f"{BASE_URL}/assets/{created_asset_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={"value": 12000},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("value") == 12000:
                log_pass("Assets - Update value")
            else:
                log_fail("Assets - Update value", f"Expected value=12000, got {data.get('value')}")
        else:
            log_fail("Assets - Update value", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Assets - Update value", f"Exception: {str(e)}")
else:
    log_fail("Assets - Update value", "No asset ID available")

# Test 3.5: Delete custom asset
print("\n[Test 3.5] DELETE /assets/{id} - Delete custom asset")
if created_custom_asset_id:
    try:
        response = requests.delete(
            f"{BASE_URL}/assets/{created_custom_asset_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                # Verify deletion
                verify_response = requests.get(
                    f"{BASE_URL}/assets",
                    headers={"Authorization": f"Bearer {regular_user_token}"},
                    timeout=10
                )
                assets = verify_response.json()
                if not any(a.get("id") == created_custom_asset_id for a in assets):
                    log_pass("Assets - Delete asset")
                else:
                    log_fail("Assets - Delete asset", "Asset still exists after deletion")
            else:
                log_fail("Assets - Delete asset", "success not true")
        else:
            log_fail("Assets - Delete asset", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Assets - Delete asset", f"Exception: {str(e)}")
else:
    log_fail("Assets - Delete asset", "No custom asset ID available")

# ============================================================================
# 4. LIABILITIES CRUD TESTS
# ============================================================================
print("\n" + "=" * 80)
print("4. LIABILITIES CRUD TESTS")
print("=" * 80)

# Test 4.1: Create liability
print("\n[Test 4.1] POST /liabilities - Create liability")
try:
    response = requests.post(
        f"{BASE_URL}/liabilities",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        json={
            "name": "Home Mortgage",
            "category": "Mortgage",
            "value": 4000,
            "notes": "Monthly payment"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "id" in data:
            created_liability_id = data["id"]
            log_pass("Liabilities - Create liability")
        else:
            log_fail("Liabilities - Create", "Missing id in response")
    else:
        log_fail("Liabilities - Create", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Liabilities - Create", f"Exception: {str(e)}")

# Test 4.2: GET all liabilities
print("\n[Test 4.2] GET /liabilities - List all")
try:
    response = requests.get(
        f"{BASE_URL}/liabilities",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list) and len(data) >= 1:
            log_pass("Liabilities - GET all")
        else:
            log_fail("Liabilities - GET all", f"Expected array with 1+ items")
    else:
        log_fail("Liabilities - GET all", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Liabilities - GET all", f"Exception: {str(e)}")

# Test 4.3: Update liability
print("\n[Test 4.3] PUT /liabilities/{id} - Update value")
if created_liability_id:
    try:
        response = requests.put(
            f"{BASE_URL}/liabilities/{created_liability_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={"value": 4500},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("value") == 4500:
                log_pass("Liabilities - Update value")
            else:
                log_fail("Liabilities - Update", f"Expected value=4500, got {data.get('value')}")
        else:
            log_fail("Liabilities - Update", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Liabilities - Update", f"Exception: {str(e)}")
else:
    log_fail("Liabilities - Update", "No liability ID available")

# Test 4.4: Delete liability
print("\n[Test 4.4] DELETE /liabilities/{id}")
if created_liability_id:
    try:
        response = requests.delete(
            f"{BASE_URL}/liabilities/{created_liability_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                log_pass("Liabilities - Delete")
            else:
                log_fail("Liabilities - Delete", "success not true")
        else:
            log_fail("Liabilities - Delete", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Liabilities - Delete", f"Exception: {str(e)}")
else:
    log_fail("Liabilities - Delete", "No liability ID available")

# ============================================================================
# 5. GOALS CRUD TESTS
# ============================================================================
print("\n" + "=" * 80)
print("5. GOALS CRUD TESTS")
print("=" * 80)

# Test 5.1: Create goal
print("\n[Test 5.1] POST /goals - Create goal")
try:
    response = requests.post(
        f"{BASE_URL}/goals",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        json={
            "title": "Retirement Fund",
            "targetAmount": 100000,
            "targetDate": "2030-01-01"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "id" in data:
            created_goal_id = data["id"]
            log_pass("Goals - Create goal")
        else:
            log_fail("Goals - Create", "Missing id in response")
    else:
        log_fail("Goals - Create", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Goals - Create", f"Exception: {str(e)}")

# Test 5.2: GET all goals
print("\n[Test 5.2] GET /goals - List all")
try:
    response = requests.get(
        f"{BASE_URL}/goals",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list) and len(data) >= 1:
            log_pass("Goals - GET all")
        else:
            log_fail("Goals - GET all", "Expected array with 1+ items")
    else:
        log_fail("Goals - GET all", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Goals - GET all", f"Exception: {str(e)}")

# Test 5.3: Update goal
print("\n[Test 5.3] PUT /goals/{id} - Update targetAmount")
if created_goal_id:
    try:
        response = requests.put(
            f"{BASE_URL}/goals/{created_goal_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={"targetAmount": 150000},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("targetAmount") == 150000:
                log_pass("Goals - Update targetAmount")
            else:
                log_fail("Goals - Update", f"Expected 150000, got {data.get('targetAmount')}")
        else:
            log_fail("Goals - Update", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Goals - Update", f"Exception: {str(e)}")
else:
    log_fail("Goals - Update", "No goal ID available")

# Test 5.4: Delete goal
print("\n[Test 5.4] DELETE /goals/{id}")
if created_goal_id:
    try:
        response = requests.delete(
            f"{BASE_URL}/goals/{created_goal_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                log_pass("Goals - Delete")
            else:
                log_fail("Goals - Delete", "success not true")
        else:
            log_fail("Goals - Delete", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Goals - Delete", f"Exception: {str(e)}")
else:
    log_fail("Goals - Delete", "No goal ID available")

# ============================================================================
# 6. DASHBOARD TESTS
# ============================================================================
print("\n" + "=" * 80)
print("6. DASHBOARD TESTS")
print("=" * 80)

# Test 6.1: GET dashboard
print("\n[Test 6.1] GET /dashboard - Verify structure and calculations")
try:
    response = requests.get(
        f"{BASE_URL}/dashboard",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:1000]}")
    
    if response.status_code == 200:
        data = response.json()
        required_keys = ["summary", "allocation", "liabilityBreakdown", "history", "goals"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            log_fail("Dashboard - Structure", f"Missing keys: {missing_keys}")
        else:
            summary = data.get("summary", {})
            summary_keys = ["netWorth", "totalAssets", "totalLiabilities", "growth", "growthAmount"]
            missing_summary = [k for k in summary_keys if k not in summary]
            
            if missing_summary:
                log_fail("Dashboard - Summary keys", f"Missing: {missing_summary}")
            else:
                # Verify calculation: netWorth = totalAssets - totalLiabilities
                net_worth = summary.get("netWorth", 0)
                total_assets = summary.get("totalAssets", 0)
                total_liabilities = summary.get("totalLiabilities", 0)
                expected_net_worth = total_assets - total_liabilities
                
                print(f"  Net Worth: {net_worth}")
                print(f"  Total Assets: {total_assets}")
                print(f"  Total Liabilities: {total_liabilities}")
                print(f"  Expected Net Worth: {expected_net_worth}")
                
                if net_worth == expected_net_worth:
                    log_pass("Dashboard - Calculation correctness (netWorth = assets - liabilities)")
                else:
                    log_fail("Dashboard - Calculation", f"netWorth={net_worth} != {expected_net_worth}")
    else:
        log_fail("Dashboard - GET", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Dashboard - GET", f"Exception: {str(e)}")

# ============================================================================
# 7. CSV EXPORT TESTS
# ============================================================================
print("\n" + "=" * 80)
print("7. CSV EXPORT TESTS")
print("=" * 80)

# Test 7.1: GET CSV export
print("\n[Test 7.1] GET /export - CSV export")
try:
    response = requests.get(
        f"{BASE_URL}/export",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    print(f"Response (first 300 chars): {response.text[:300]}")
    
    if response.status_code == 200:
        content_type = response.headers.get('Content-Type', '')
        if 'text/csv' in content_type:
            # Check for header row
            if 'Type,Name,Category,Value,Notes' in response.text or 'Type","Name","Category","Value","Notes' in response.text:
                log_pass("CSV Export - Format and headers")
            else:
                log_fail("CSV Export - Headers", "Missing expected header row")
        else:
            log_fail("CSV Export - Content-Type", f"Expected text/csv, got {content_type}")
    else:
        log_fail("CSV Export", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("CSV Export", f"Exception: {str(e)}")

# ============================================================================
# 8. ADMIN TESTS
# ============================================================================
print("\n" + "=" * 80)
print("8. ADMIN TESTS")
print("=" * 80)

# Test 8.1: Admin endpoints with regular user (should be 403)
print("\n[Test 8.1] GET /admin/metrics - With regular user (expect 403)")
try:
    response = requests.get(
        f"{BASE_URL}/admin/metrics",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 403:
        log_pass("Admin - /admin/metrics with regular user (403)")
    else:
        log_fail("Admin - /admin/metrics", f"Expected 403, got {response.status_code}")
except Exception as e:
    log_fail("Admin - /admin/metrics", f"Exception: {str(e)}")

print("\n[Test 8.2] GET /admin/users - With regular user (expect 403)")
try:
    response = requests.get(
        f"{BASE_URL}/admin/users",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 403:
        log_pass("Admin - /admin/users with regular user (403)")
    else:
        log_fail("Admin - /admin/users", f"Expected 403, got {response.status_code}")
except Exception as e:
    log_fail("Admin - /admin/users", f"Exception: {str(e)}")

print("\n[Test 8.3] GET /admin/audit - With regular user (expect 403)")
try:
    response = requests.get(
        f"{BASE_URL}/admin/audit",
        headers={"Authorization": f"Bearer {regular_user_token}"},
        timeout=10
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 403:
        log_pass("Admin - /admin/audit with regular user (403)")
    else:
        log_fail("Admin - /admin/audit", f"Expected 403, got {response.status_code}")
except Exception as e:
    log_fail("Admin - /admin/audit", f"Exception: {str(e)}")

# Test 8.4: Login as admin and test admin endpoints
print("\n[Test 8.4] POST /auth/login - Admin user")
try:
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "admin@networth.app",
            "password": "test1234"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data and data.get("user", {}).get("role") == "admin":
            admin_token = data["token"]
            log_pass("Admin - Login as admin")
        else:
            log_fail("Admin - Login", "Missing token or not admin role")
    else:
        log_fail("Admin - Login", f"Expected 200, got {response.status_code}")
except Exception as e:
    log_fail("Admin - Login", f"Exception: {str(e)}")

# Test 8.5: GET /admin/metrics with admin token
print("\n[Test 8.5] GET /admin/metrics - With admin token")
if admin_token:
    try:
        response = requests.get(
            f"{BASE_URL}/admin/metrics",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["totalUsers", "totalAssets", "totalLiabilities", "totalGoals"]
            missing = [k for k in required_keys if k not in data]
            if not missing:
                log_pass("Admin - /admin/metrics with admin token")
            else:
                log_fail("Admin - /admin/metrics", f"Missing keys: {missing}")
        else:
            log_fail("Admin - /admin/metrics", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Admin - /admin/metrics", f"Exception: {str(e)}")
else:
    log_fail("Admin - /admin/metrics", "No admin token available")

# Test 8.6: GET /admin/users with admin token
print("\n[Test 8.6] GET /admin/users - With admin token")
if admin_token:
    try:
        response = requests.get(
            f"{BASE_URL}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_pass("Admin - /admin/users with admin token")
            else:
                log_fail("Admin - /admin/users", "Expected array response")
        else:
            log_fail("Admin - /admin/users", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Admin - /admin/users", f"Exception: {str(e)}")
else:
    log_fail("Admin - /admin/users", "No admin token available")

# Test 8.7: GET /admin/audit with admin token
print("\n[Test 8.7] GET /admin/audit - With admin token")
if admin_token:
    try:
        response = requests.get(
            f"{BASE_URL}/admin/audit",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_pass("Admin - /admin/audit with admin token")
            else:
                log_fail("Admin - /admin/audit", "Expected array response")
        else:
            log_fail("Admin - /admin/audit", f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_fail("Admin - /admin/audit", f"Exception: {str(e)}")
else:
    log_fail("Admin - /admin/audit", "No admin token available")

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"✅ PASSED: {len(test_results['passed'])}")
print(f"❌ FAILED: {len(test_results['failed'])}")
print(f"⚠️  WARNINGS: {len(test_results['warnings'])}")

if test_results['failed']:
    print("\nFailed Tests:")
    for fail in test_results['failed']:
        print(f"  - {fail}")

if test_results['warnings']:
    print("\nWarnings:")
    for warn in test_results['warnings']:
        print(f"  - {warn}")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)

# Exit with appropriate code
exit(0 if len(test_results['failed']) == 0 else 1)
