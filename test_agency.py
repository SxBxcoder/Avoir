import requests

def test_agency():
    # 1. Test get clients
    res = requests.get('http://127.0.0.1:8000/api/agency/clients')
    print("Clients:", res.json())

    # 2. Test generate link
    payload = {
        "agency_id": "test_agency",
        "campaign_data": {
            "hook": "This is a god-tier hook",
            "offer": "50% off everything",
            "cta": "Buy now or cry later",
            "captions": ["Caption 1", "Caption 2"],
            "image_url": "https://images.unsplash.com/photo-1504274066651-8d31a536b11a?w=800"
        }
    }
    res = requests.post('http://127.0.0.1:8000/api/agency/share-link', json=payload)
    data = res.json()
    print("Share Link:", data)

    # 3. Test public fetch
    share_url = data['share_url']
    link_id = share_url.split('/')[-1]
    res = requests.get(f'http://127.0.0.1:8000/api/public/campaign/{link_id}')
    print("Public Campaign Data:", res.json())

    with open('.test_link.txt', 'w') as f:
        f.write(share_url)

if __name__ == '__main__':
    test_agency()
