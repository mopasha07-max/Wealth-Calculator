#!/usr/bin/env python3
"""
Phase 2 Backend API Tests for Net Worth Tracker
Tests: Config, Google Sign-In (unconfigured), Forgot/Reset Password, Crypto, Plaid (unconfigured), Auth Guards
"""

import requests
import json
import time
import random
import string

# Base URL from .env
BASE_URL = "https://financial-pulse-165.preview.emergentagent.com/api"

# Test results tracking
test_results = []

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status}: {name}"
    if details:
        result += f" - {details}"
    print(result)
    test_results.append({"name": name, "passed": passed, "details": details})

def random_email():
    """Generate random email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand}@test.com"

def test_config():
    """Test 1: GET /api/config with valid token"""
    print("\n=== TEST 1: CONFIG ENDPOINT ===")
    try:
        # First login as admin to get a valid token
        login_resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@networth.app",
            "password": "test1234"
        })
        
        if login_resp.status_code != 200:
            log_test("Config - Admin Login", False, f"Admin login failed: {login_resp.status_code}")
            return None
        
        token = login_resp.json().get("token")
        
        # Test config endpoint
        resp = requests.get(f"{BASE_URL}/config", headers={
            "Authorization": f"Bearer {token}"
        })
        
        if resp.status_code != 200:
            log_test("Config - GET /api/config", False, f"Status {resp.status_code}, expected 200")
            return token
        
        data = resp.json()
        
        # Verify structure
        if "googleEnabled" not in data or "plaidEnabled" not in data:
            log_test("Config - Response Structure", False, f"Missing keys in response: {data}")
            return token
        
        # Verify values (should be false since keys are unset)
        if data["googleEnabled"] != False or data["plaidEnabled"] != False:
            log_test("Config - Values", False, f"Expected both false, got: {data}")
            return token
        
        log_test("Config - GET /api/config", True, f"Returns {data}")
        return token
        
    except Exception as e:
        log_test("Config - Exception", False, str(e))
        return None

def test_google_unconfigured():
    """Test 2: POST /api/auth/google (unconfigured)"""
    print("\n=== TEST 2: GOOGLE SIGN-IN (UNCONFIGURED) ===")
    try:
        resp = requests.post(f"{BASE_URL}/auth/google", json={
            "credential": "anything"
        })
        
        if resp.status_code != 503:
            log_test("Google - Unconfigured Status", False, f"Status {resp.status_code}, expected 503")
            return
        
        data = resp.json()
        if "error" not in data or "not configured" not in data["error"].lower():
            log_test("Google - Error Message", False, f"Unexpected error: {data}")
            return
        
        log_test("Google - POST /api/auth/google", True, f"Returns 503 with error: {data['error']}")
        
    except Exception as e:
        log_test("Google - Exception", False, str(e))

def test_forgot_reset_password():
    """Test 3: Forgot/Reset Password Flow"""
    print("\n=== TEST 3: FORGOT/RESET PASSWORD FLOW ===")
    
    # Step 1: Create fresh user
    fresh_email = random_email()
    fresh_password = "orig1234"
    
    try:
        signup_resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": fresh_email,
            "password": fresh_password,
            "name": "Reset Test User"
        })
        
        if signup_resp.status_code != 200:
            log_test("Forgot/Reset - Signup Fresh User", False, f"Status {signup_resp.status_code}")
            return
        
        log_test("Forgot/Reset - Signup Fresh User", True, f"Created {fresh_email}")
        
    except Exception as e:
        log_test("Forgot/Reset - Signup Exception", False, str(e))
        return
    
    # Step 2: POST /api/auth/forgot with valid email
    try:
        forgot_resp = requests.post(f"{BASE_URL}/auth/forgot", json={
            "email": fresh_email
        })
        
        if forgot_resp.status_code != 200:
            log_test("Forgot/Reset - Forgot Request", False, f"Status {forgot_resp.status_code}")
            return
        
        forgot_data = forgot_resp.json()
        
        if not forgot_data.get("ok"):
            log_test("Forgot/Reset - Forgot Response ok", False, f"Expected ok:true, got {forgot_data}")
            return
        
        if "devToken" not in forgot_data:
            log_test("Forgot/Reset - devToken Present", False, f"No devToken in response: {forgot_data}")
            return
        
        dev_token = forgot_data["devToken"]
        log_test("Forgot/Reset - POST /api/auth/forgot", True, f"Returns ok:true with devToken")
        
    except Exception as e:
        log_test("Forgot/Reset - Forgot Exception", False, str(e))
        return
    
    # Step 3: POST /api/auth/forgot with nonexistent email (no account leak)
    try:
        nonexistent_email = random_email()
        forgot_nonexist = requests.post(f"{BASE_URL}/auth/forgot", json={
            "email": nonexistent_email
        })
        
        if forgot_nonexist.status_code != 200:
            log_test("Forgot/Reset - Nonexistent Email Status", False, f"Status {forgot_nonexist.status_code}")
            return
        
        nonexist_data = forgot_nonexist.json()
        
        if not nonexist_data.get("ok"):
            log_test("Forgot/Reset - No Account Leak", False, f"Should return ok:true for nonexistent, got {nonexist_data}")
            return
        
        log_test("Forgot/Reset - No Account Leak", True, "Returns ok:true for nonexistent email")
        
    except Exception as e:
        log_test("Forgot/Reset - Nonexistent Exception", False, str(e))
        return
    
    # Step 4: POST /api/auth/reset with devToken
    new_password = "new5678"
    try:
        reset_resp = requests.post(f"{BASE_URL}/auth/reset", json={
            "email": fresh_email,
            "token": dev_token,
            "password": new_password
        })
        
        if reset_resp.status_code != 200:
            log_test("Forgot/Reset - Reset Password", False, f"Status {reset_resp.status_code}, response: {reset_resp.text}")
            return
        
        reset_data = reset_resp.json()
        
        if not reset_data.get("ok"):
            log_test("Forgot/Reset - Reset Response ok", False, f"Expected ok:true, got {reset_data}")
            return
        
        log_test("Forgot/Reset - POST /api/auth/reset", True, "Password reset successful")
        
    except Exception as e:
        log_test("Forgot/Reset - Reset Exception", False, str(e))
        return
    
    # Step 5: Verify old password fails
    try:
        old_login = requests.post(f"{BASE_URL}/auth/login", json={
            "email": fresh_email,
            "password": fresh_password
        })
        
        if old_login.status_code == 200:
            log_test("Forgot/Reset - Old Password Fails", False, "Old password still works!")
            return
        
        if old_login.status_code != 401:
            log_test("Forgot/Reset - Old Password Status", False, f"Expected 401, got {old_login.status_code}")
            return
        
        log_test("Forgot/Reset - Old Password Fails", True, "Old password returns 401")
        
    except Exception as e:
        log_test("Forgot/Reset - Old Password Exception", False, str(e))
        return
    
    # Step 6: Verify new password works
    try:
        new_login = requests.post(f"{BASE_URL}/auth/login", json={
            "email": fresh_email,
            "password": new_password
        })
        
        if new_login.status_code != 200:
            log_test("Forgot/Reset - New Password Works", False, f"Status {new_login.status_code}")
            return
        
        new_data = new_login.json()
        
        if "token" not in new_data or "user" not in new_data:
            log_test("Forgot/Reset - New Password Response", False, f"Missing token/user: {new_data}")
            return
        
        log_test("Forgot/Reset - New Password Works", True, "New password login successful")
        
    except Exception as e:
        log_test("Forgot/Reset - New Password Exception", False, str(e))
        return
    
    # Step 7: Test with wrong/garbage token
    try:
        wrong_reset = requests.post(f"{BASE_URL}/auth/reset", json={
            "email": fresh_email,
            "token": "garbage_token_12345",
            "password": "another_password"
        })
        
        if wrong_reset.status_code != 400:
            log_test("Forgot/Reset - Wrong Token Status", False, f"Expected 400, got {wrong_reset.status_code}")
            return
        
        log_test("Forgot/Reset - Wrong Token Returns 400", True, "Invalid token returns 400")
        
    except Exception as e:
        log_test("Forgot/Reset - Wrong Token Exception", False, str(e))

def test_crypto(token):
    """Test 4: Crypto Endpoints"""
    print("\n=== TEST 4: CRYPTO ENDPOINTS ===")
    
    if not token:
        log_test("Crypto - Token Missing", False, "No valid token provided")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 1: GET /api/crypto/coins
    try:
        coins_resp = requests.get(f"{BASE_URL}/crypto/coins", headers=headers)
        
        if coins_resp.status_code != 200:
            log_test("Crypto - GET /api/crypto/coins", False, f"Status {coins_resp.status_code}")
            return
        
        coins = coins_resp.json()
        
        if not isinstance(coins, list) or len(coins) == 0:
            log_test("Crypto - Coins Array", False, f"Expected non-empty array, got {type(coins)}")
            return
        
        # Verify structure
        bitcoin = next((c for c in coins if c.get("id") == "bitcoin"), None)
        if not bitcoin or bitcoin.get("symbol") != "BTC":
            log_test("Crypto - Coins Structure", False, f"Bitcoin not found or invalid: {bitcoin}")
            return
        
        log_test("Crypto - GET /api/crypto/coins", True, f"Returns {len(coins)} coins including BTC")
        
    except Exception as e:
        log_test("Crypto - Coins Exception", False, str(e))
        return
    
    # Step 2: POST /api/crypto (bitcoin)
    bitcoin_id = None
    try:
        create_btc = requests.post(f"{BASE_URL}/crypto", headers=headers, json={
            "coinId": "bitcoin",
            "quantity": 0.5,
            "averageCostUsd": 40000
        })
        
        if create_btc.status_code != 200:
            log_test("Crypto - POST bitcoin", False, f"Status {create_btc.status_code}, response: {create_btc.text}")
            return
        
        btc_data = create_btc.json()
        
        if "id" not in btc_data or btc_data.get("symbol") != "BTC":
            log_test("Crypto - Bitcoin Response", False, f"Invalid response: {btc_data}")
            return
        
        bitcoin_id = btc_data["id"]
        log_test("Crypto - POST bitcoin", True, f"Created BTC holding with id {bitcoin_id}")
        
    except Exception as e:
        log_test("Crypto - Bitcoin Exception", False, str(e))
        return
    
    # Step 3: POST /api/crypto (ethereum)
    ethereum_id = None
    try:
        create_eth = requests.post(f"{BASE_URL}/crypto", headers=headers, json={
            "coinId": "ethereum",
            "quantity": 2,
            "averageCostUsd": 2000
        })
        
        if create_eth.status_code != 200:
            log_test("Crypto - POST ethereum", False, f"Status {create_eth.status_code}")
            return
        
        eth_data = create_eth.json()
        ethereum_id = eth_data.get("id")
        
        log_test("Crypto - POST ethereum", True, f"Created ETH holding")
        
    except Exception as e:
        log_test("Crypto - Ethereum Exception", False, str(e))
        return
    
    # Step 4: POST /api/crypto with invalid coin
    try:
        invalid_coin = requests.post(f"{BASE_URL}/crypto", headers=headers, json={
            "coinId": "not-a-coin",
            "quantity": 1
        })
        
        if invalid_coin.status_code != 400:
            log_test("Crypto - Invalid Coin Status", False, f"Expected 400, got {invalid_coin.status_code}")
            return
        
        error_data = invalid_coin.json()
        if "error" not in error_data or "unknown coin" not in error_data["error"].lower():
            log_test("Crypto - Invalid Coin Error", False, f"Unexpected error: {error_data}")
            return
        
        log_test("Crypto - Invalid Coin Returns 400", True, "Unknown coin returns 400")
        
    except Exception as e:
        log_test("Crypto - Invalid Coin Exception", False, str(e))
        return
    
    # Step 5: GET /api/crypto and verify math
    try:
        holdings_resp = requests.get(f"{BASE_URL}/crypto", headers=headers)
        
        if holdings_resp.status_code != 200:
            log_test("Crypto - GET /api/crypto", False, f"Status {holdings_resp.status_code}")
            return
        
        holdings_data = holdings_resp.json()
        
        # Verify structure
        if "rows" not in holdings_data or "totalValue" not in holdings_data:
            log_test("Crypto - Holdings Structure", False, f"Missing keys: {holdings_data.keys()}")
            return
        
        rows = holdings_data["rows"]
        total_value = holdings_data["totalValue"]
        total_gain_loss = holdings_data["totalGainLoss"]
        total_daily = holdings_data.get("totalDailyGainLoss", 0)
        
        log_test("Crypto - GET /api/crypto Structure", True, f"Returns {len(rows)} holdings")
        
        # Verify math for each row
        math_errors = []
        calculated_total_value = 0
        
        for row in rows:
            coin_id = row.get("coinId")
            quantity = row.get("quantity", 0)
            avg_cost = row.get("averageCostUsd", 0)
            current_price = row.get("currentPrice")
            value = row.get("value")
            gain_loss = row.get("gainLoss")
            daily_gain_loss = row.get("dailyGainLoss")
            change_pct = row.get("changePct")
            
            # Verify currentPrice is positive
            if current_price is None or current_price <= 0:
                math_errors.append(f"{coin_id}: currentPrice is {current_price}, expected positive number")
                continue
            
            # Verify value ≈ quantity * currentPrice (allow 1% tolerance)
            expected_value = quantity * current_price
            if value is None or abs(value - expected_value) > expected_value * 0.01:
                math_errors.append(f"{coin_id}: value={value}, expected≈{expected_value}")
            
            calculated_total_value += value if value is not None else 0
            
            # Verify gainLoss ≈ value - quantity * averageCostUsd
            expected_gain_loss = value - (quantity * avg_cost)
            if gain_loss is not None and abs(gain_loss - expected_gain_loss) > abs(expected_gain_loss) * 0.01 + 0.01:
                math_errors.append(f"{coin_id}: gainLoss={gain_loss}, expected≈{expected_gain_loss}")
            
            # Verify dailyGainLoss ≈ value * changePct / 100 (if changePct present)
            if change_pct is not None and daily_gain_loss is not None:
                expected_daily = value * (change_pct / 100)
                if abs(daily_gain_loss - expected_daily) > abs(expected_daily) * 0.01 + 0.01:
                    math_errors.append(f"{coin_id}: dailyGainLoss={daily_gain_loss}, expected≈{expected_daily}")
        
        # Verify totalValue ≈ sum of row values
        if abs(total_value - calculated_total_value) > calculated_total_value * 0.01 + 0.01:
            math_errors.append(f"totalValue={total_value}, expected≈{calculated_total_value}")
        
        if math_errors:
            log_test("Crypto - Math Verification", False, "; ".join(math_errors))
        else:
            log_test("Crypto - Math Verification", True, f"All calculations correct (totalValue≈{total_value:.2f})")
        
    except Exception as e:
        log_test("Crypto - Holdings Exception", False, str(e))
        return
    
    # Step 6: PUT /api/crypto/{id} (update quantity)
    if bitcoin_id:
        try:
            update_resp = requests.put(f"{BASE_URL}/crypto/{bitcoin_id}", headers=headers, json={
                "quantity": 1
            })
            
            if update_resp.status_code != 200:
                log_test("Crypto - PUT update", False, f"Status {update_resp.status_code}")
            else:
                updated_data = update_resp.json()
                if updated_data.get("quantity") != 1:
                    log_test("Crypto - PUT quantity", False, f"Expected quantity=1, got {updated_data.get('quantity')}")
                else:
                    log_test("Crypto - PUT /api/crypto/{id}", True, "Updated quantity to 1")
            
        except Exception as e:
            log_test("Crypto - Update Exception", False, str(e))
    
    # Step 7: DELETE /api/crypto/{id}
    if ethereum_id:
        try:
            delete_resp = requests.delete(f"{BASE_URL}/crypto/{ethereum_id}", headers=headers)
            
            if delete_resp.status_code != 200:
                log_test("Crypto - DELETE status", False, f"Status {delete_resp.status_code}")
            else:
                delete_data = delete_resp.json()
                if not delete_data.get("success"):
                    log_test("Crypto - DELETE response", False, f"Expected success:true, got {delete_data}")
                else:
                    # Verify it's gone
                    verify_resp = requests.get(f"{BASE_URL}/crypto", headers=headers)
                    verify_data = verify_resp.json()
                    eth_still_exists = any(r.get("id") == ethereum_id for r in verify_data.get("rows", []))
                    
                    if eth_still_exists:
                        log_test("Crypto - DELETE verification", False, "ETH holding still exists after delete")
                    else:
                        log_test("Crypto - DELETE /api/crypto/{id}", True, "Deleted ETH holding")
            
        except Exception as e:
            log_test("Crypto - Delete Exception", False, str(e))

def test_plaid_unconfigured(token):
    """Test 5: Plaid Endpoints (unconfigured)"""
    print("\n=== TEST 5: PLAID ENDPOINTS (UNCONFIGURED) ===")
    
    if not token:
        log_test("Plaid - Token Missing", False, "No valid token provided")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: POST /api/plaid/link-token
    try:
        link_resp = requests.post(f"{BASE_URL}/plaid/link-token", headers=headers)
        
        if link_resp.status_code != 503:
            log_test("Plaid - link-token Status", False, f"Expected 503, got {link_resp.status_code}")
        else:
            link_data = link_resp.json()
            if "error" not in link_data or "not configured" not in link_data["error"].lower():
                log_test("Plaid - link-token Error", False, f"Unexpected error: {link_data}")
            else:
                log_test("Plaid - POST /api/plaid/link-token", True, "Returns 503")
        
    except Exception as e:
        log_test("Plaid - link-token Exception", False, str(e))
    
    # Test 2: POST /api/plaid/exchange
    try:
        exchange_resp = requests.post(f"{BASE_URL}/plaid/exchange", headers=headers, json={
            "public_token": "x"
        })
        
        if exchange_resp.status_code != 503:
            log_test("Plaid - exchange Status", False, f"Expected 503, got {exchange_resp.status_code}")
        else:
            log_test("Plaid - POST /api/plaid/exchange", True, "Returns 503")
        
    except Exception as e:
        log_test("Plaid - exchange Exception", False, str(e))
    
    # Test 3: GET /api/plaid/balances
    try:
        balances_resp = requests.get(f"{BASE_URL}/plaid/balances", headers=headers)
        
        if balances_resp.status_code != 503:
            log_test("Plaid - balances Status", False, f"Expected 503, got {balances_resp.status_code}")
        else:
            log_test("Plaid - GET /api/plaid/balances", True, "Returns 503")
        
    except Exception as e:
        log_test("Plaid - balances Exception", False, str(e))
    
    # Test 4: POST /api/plaid/sync
    try:
        sync_resp = requests.post(f"{BASE_URL}/plaid/sync", headers=headers)
        
        if sync_resp.status_code != 503:
            log_test("Plaid - sync Status", False, f"Expected 503, got {sync_resp.status_code}")
        else:
            log_test("Plaid - POST /api/plaid/sync", True, "Returns 503")
        
    except Exception as e:
        log_test("Plaid - sync Exception", False, str(e))

def test_auth_guard():
    """Test 6: Auth Guard - endpoints without token"""
    print("\n=== TEST 6: AUTH GUARD ===")
    
    # Test 1: GET /api/crypto without token
    try:
        crypto_resp = requests.get(f"{BASE_URL}/crypto")
        
        if crypto_resp.status_code != 401:
            log_test("Auth Guard - GET /api/crypto", False, f"Expected 401, got {crypto_resp.status_code}")
        else:
            log_test("Auth Guard - GET /api/crypto", True, "Returns 401 without token")
        
    except Exception as e:
        log_test("Auth Guard - crypto Exception", False, str(e))
    
    # Test 2: GET /api/config without token
    try:
        config_resp = requests.get(f"{BASE_URL}/config")
        
        if config_resp.status_code != 401:
            log_test("Auth Guard - GET /api/config", False, f"Expected 401, got {config_resp.status_code}")
        else:
            log_test("Auth Guard - GET /api/config", True, "Returns 401 without token")
        
    except Exception as e:
        log_test("Auth Guard - config Exception", False, str(e))

def main():
    """Run all Phase 2 tests"""
    print("=" * 80)
    print("PHASE 2 BACKEND API TESTS - NET WORTH TRACKER")
    print("=" * 80)
    
    # Test 1: Config
    token = test_config()
    
    # Test 2: Google (unconfigured)
    test_google_unconfigured()
    
    # Test 3: Forgot/Reset Password
    test_forgot_reset_password()
    
    # Test 4: Crypto
    test_crypto(token)
    
    # Test 5: Plaid (unconfigured)
    test_plaid_unconfigured(token)
    
    # Test 6: Auth Guard
    test_auth_guard()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for t in test_results if t["passed"])
    failed = sum(1 for t in test_results if not t["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for t in test_results:
            if not t["passed"]:
                print(f"  - {t['name']}: {t['details']}")
    
    print("\n" + "=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
