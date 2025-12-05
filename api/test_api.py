#!/usr/bin/env python3
"""
Quick test script to verify the API is working
Run: python test_api.py
"""

import requests
import json

API_BASE = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("🏥 Testing health endpoint...")
    response = requests.get(f"{API_BASE}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}\n")

def test_employees():
    """Test employees endpoint"""
    print("👥 Testing employees endpoint...")
    response = requests.get(f"{API_BASE}/api/employees")

    if response.status_code == 200:
        employees = response.json()
        print(f"   ✅ Found {len(employees)} employees")

        if employees:
            emp = employees[0]
            print(f"\n   Sample Employee:")
            print(f"   - Code: {emp['employee_code']}")
            print(f"   - Name: {emp['full_name']}")
            print(f"   - Department: {emp.get('department', {}).get('name', 'N/A')}")
            print(f"   - Active Qualifications: {emp['total_qualifications']}")
            print(f"   - Has Anomalies: {emp['has_anomalies']}")
            print(f"   - Active Contract: {emp['has_active_contract']}")

            if emp['active_qualifications']:
                print(f"\n   Qualifications:")
                for qual in emp['active_qualifications'][:3]:
                    qual_type = qual.get('qualification_types', {})
                    print(f"   - {qual_type.get('name', 'Unknown')}")

            if emp['active_anomalies']:
                print(f"\n   Active Anomalies:")
                for anomaly in emp['active_anomalies']:
                    print(f"   - {anomaly['anomaly_type']}: {anomaly.get('restrictions', 'N/A')}")
    else:
        print(f"   ❌ Error: {response.status_code}")
        print(f"   {response.text}")

    print()

def test_departments():
    """Test departments endpoint"""
    print("🏢 Testing departments endpoint...")
    response = requests.get(f"{API_BASE}/api/departments")

    if response.status_code == 200:
        departments = response.json()
        print(f"   ✅ Found {len(departments)} departments")
        if departments:
            dept = departments[0]
            print(f"   Sample: {dept.get('name')} ({dept.get('code')})")
    else:
        print(f"   ❌ Error: {response.status_code}")

    print()

def test_shifts():
    """Test shifts endpoint"""
    print("📅 Testing shifts endpoint...")
    response = requests.get(f"{API_BASE}/api/shifts")

    if response.status_code == 200:
        shifts = response.json()
        print(f"   ✅ Found {len(shifts)} shifts")
        if shifts:
            shift = shifts[0]
            print(f"   Sample: {shift.get('shift_date')} {shift.get('start_time')}-{shift.get('end_time')}")
    else:
        print(f"   ❌ Error: {response.status_code}")

    print()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("   STAFF ADMIN & ROSTERING API - QUICK TEST")
    print("="*60 + "\n")

    try:
        test_health()
        test_employees()
        test_departments()
        test_shifts()

        print("="*60)
        print("✅ API is running! Visit http://localhost:8000/docs")
        print("="*60 + "\n")

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to API")
        print("   Make sure the API is running:")
        print("   cd api && ./run.sh\n")
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
