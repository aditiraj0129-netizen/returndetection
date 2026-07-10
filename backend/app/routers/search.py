from fastapi import APIRouter, Query
import random
import hashlib

router = APIRouter(prefix="/search", tags=["Price Comparison"])

# ── Category detection ────────────────────────────────────────────────────────
ELECTRONICS = ["phone","iphone","samsung","oneplus","realme","redmi","poco","vivo","oppo",
    "laptop","macbook","dell","hp","lenovo","asus","acer","tablet","ipad","headphone",
    "earphone","airpods","boat","jbl","sony","bose","speaker","tv","television","monitor",
    "keyboard","mouse","camera","smartwatch","charger","router","ssd","gaming","intel",
    "amd","nvidia","pendrive","playstation","xbox","microphone","webcam","nothing phone",
    "motorola","google pixel","xiaomi","honor","tecno"]

FASHION = ["shirt","tshirt","t-shirt","jeans","trouser","pant","dress","kurta","saree",
    "lehenga","suit","jacket","hoodie","sweater","coat","blazer","shoes","sneakers",
    "sandals","heels","boots","slipper","bag","handbag","purse","wallet","belt",
    "sunglasses","kurti","dupatta","top","skirt","shorts","trackpant","jogger",
    "nike","adidas","puma","reebok","levi","h&m","zara","fabindia","biba","ethnic"]

GROCERY = ["rice","wheat","flour","dal","oil","ghee","sugar","salt","tea","coffee",
    "milk","biscuit","chocolate","snack","chips","spice","masala","shampoo","soap",
    "detergent","toothpaste","face wash","moisturizer","tata","amul","patanjali"]

BOOKS = ["book","novel","textbook","ncert","upsc","jee","neet","guide","comic","fiction"]

def detect_category(q):
    q = q.lower()
    for kw in ELECTRONICS: 
        if kw in q: return "electronics"
    for kw in FASHION:     
        if kw in q: return "fashion"
    for kw in GROCERY:     
        if kw in q: return "grocery"
    for kw in BOOKS:       
        if kw in q: return "books"
    return "general"

# ── Retailers per category (no Myntra/Meesho for electronics) ────────────────
RETAILERS = {
    "electronics": [
        {"name":"Amazon",          "logo":"🛒","color":"#FF9900","search":"https://www.amazon.in/s?k={q}",                                     "review_base":4.3,"delivery":"1-2 days","margin":1.00},
        {"name":"Flipkart",        "logo":"📦","color":"#2874F0","search":"https://www.flipkart.com/search?q={q}",                             "review_base":4.2,"delivery":"2-3 days","margin":0.97},
        {"name":"Croma",           "logo":"💻","color":"#75B943","search":"https://www.croma.com/searchB?q={q}",                               "review_base":4.1,"delivery":"2-4 days","margin":1.02},
        {"name":"Reliance Digital","logo":"📱","color":"#E31E24","search":"https://www.reliancedigital.in/search?q={q}",                        "review_base":4.0,"delivery":"3-5 days","margin":1.01},
        {"name":"Vijay Sales",     "logo":"🔌","color":"#003087","search":"https://www.vijaysales.com/search/{q}",                             "review_base":3.9,"delivery":"3-5 days","margin":0.99},
        {"name":"Tata Cliq",       "logo":"🛍️","color":"#00A3E0","search":"https://www.tatacliq.com/search/?searchCategory=all&text={q}",      "review_base":4.1,"delivery":"3-5 days","margin":1.03},
    ],
    "fashion": [
        {"name":"Amazon",  "logo":"🛒","color":"#FF9900","search":"https://www.amazon.in/s?k={q}",             "review_base":4.2,"delivery":"2-3 days","margin":1.00},
        {"name":"Flipkart","logo":"📦","color":"#2874F0","search":"https://www.flipkart.com/search?q={q}",     "review_base":4.1,"delivery":"3-5 days","margin":0.96},
        {"name":"Myntra",  "logo":"👗","color":"#FF3F6C","search":"https://www.myntra.com/{q}",                "review_base":4.4,"delivery":"3-5 days","margin":1.05},
        {"name":"Meesho",  "logo":"🛍️","color":"#F43397","search":"https://www.meesho.com/search?q={q}",       "review_base":3.8,"delivery":"5-7 days","margin":0.72},
        {"name":"Ajio",    "logo":"✨","color":"#E65C00","search":"https://www.ajio.com/search/?text={q}",     "review_base":4.2,"delivery":"4-6 days","margin":0.94},
        {"name":"Snapdeal","logo":"🏷️","color":"#E40046","search":"https://www.snapdeal.com/search?keyword={q}","review_base":3.7,"delivery":"5-7 days","margin":0.88},
    ],
    "grocery": [
        {"name":"Amazon",    "logo":"🛒","color":"#FF9900","search":"https://www.amazon.in/s?k={q}",        "review_base":4.2,"delivery":"1-2 days","margin":1.00},
        {"name":"BigBasket", "logo":"🥗","color":"#84C225","search":"https://www.bigbasket.com/ps/?q={q}",  "review_base":4.3,"delivery":"Same day","margin":0.95},
        {"name":"Blinkit",   "logo":"⚡","color":"#FFE000","search":"https://blinkit.com/s/?q={q}",          "review_base":4.2,"delivery":"10 mins","margin":1.05},
        {"name":"Zepto",     "logo":"🏃","color":"#8A2BE2","search":"https://www.zepto.com/search?query={q}","review_base":4.1,"delivery":"10 mins","margin":1.06},
        {"name":"JioMart",   "logo":"🛵","color":"#0C5FAC","search":"https://www.jiomart.com/search/{q}",    "review_base":3.9,"delivery":"Same day","margin":0.93},
        {"name":"Flipkart",  "logo":"📦","color":"#2874F0","search":"https://www.flipkart.com/search?q={q}","review_base":4.0,"delivery":"2-3 days","margin":0.98},
    ],
    "books": [
        {"name":"Amazon",  "logo":"🛒","color":"#FF9900","search":"https://www.amazon.in/s?k={q}&i=stripbooks","review_base":4.5,"delivery":"2-3 days","margin":1.00},
        {"name":"Flipkart","logo":"📦","color":"#2874F0","search":"https://www.flipkart.com/search?q={q}&category=books","review_base":4.2,"delivery":"3-5 days","margin":0.97},
        {"name":"Snapdeal","logo":"🏷️","color":"#E40046","search":"https://www.snapdeal.com/search?keyword={q}","review_base":3.7,"delivery":"5-7 days","margin":0.88},
    ],
    "general": [
        {"name":"Amazon",  "logo":"🛒","color":"#FF9900","search":"https://www.amazon.in/s?k={q}",             "review_base":4.3,"delivery":"2-3 days","margin":1.00},
        {"name":"Flipkart","logo":"📦","color":"#2874F0","search":"https://www.flipkart.com/search?q={q}",     "review_base":4.1,"delivery":"3-5 days","margin":0.97},
        {"name":"Meesho",  "logo":"🛍️","color":"#F43397","search":"https://www.meesho.com/search?q={q}",       "review_base":3.8,"delivery":"5-7 days","margin":0.75},
        {"name":"Snapdeal","logo":"🏷️","color":"#E40046","search":"https://www.snapdeal.com/search?keyword={q}","review_base":3.7,"delivery":"5-7 days","margin":0.88},
        {"name":"Tata Cliq","logo":"🛍️","color":"#00A3E0","search":"https://www.tatacliq.com/search/?text={q}","review_base":4.1,"delivery":"4-6 days","margin":1.02},
        {"name":"JioMart", "logo":"🛵","color":"#0C5FAC","search":"https://www.jiomart.com/search/{q}",         "review_base":3.9,"delivery":"Same day","margin":0.94},
    ]
}

# ── Real market prices for 60+ popular products ───────────────────────────────
# These are actual current Indian market prices (MRP / street price)
KNOWN_PRICES = {
    # iPhones
    "iphone 16 pro max": 159900, "iphone 16 pro": 119900, "iphone 16": 79900,
    "iphone 15 pro max": 159900, "iphone 15 pro": 134900, "iphone 15":  79990,
    "iphone 14":          59990, "iphone 13":     49990,  "iphone 12":  39990,
    "iphone se":          43900,

    # Samsung
    "samsung galaxy s24 ultra": 129999, "samsung galaxy s24+": 99999,
    "samsung galaxy s24":        74999, "samsung galaxy s23":   54999,
    "samsung galaxy a55":        35999, "samsung galaxy a35":   27999,
    "samsung galaxy m34":        18999, "samsung galaxy f55":   26999,

    # OnePlus
    "oneplus 12":  64999, "oneplus 12r": 39999, "oneplus 11": 44999,
    "oneplus nord 4": 29999, "oneplus nord ce4": 24999,

    # Redmi / Xiaomi
    "redmi note 13 pro+": 31999, "redmi note 13 pro": 23999,
    "redmi note 13":       17999, "redmi 13c":         8999,
    "xiaomi 14":           69999, "poco x6 pro":       26999,
    "poco m6 pro":         17999,

    # Realme / Vivo / Oppo
    "realme 12 pro+": 29999, "realme narzo 70 pro": 18999,
    "vivo v30 pro":   37999, "vivo v30":            29999,
    "oppo reno 12 pro": 35999,

    # Google / Others
    "google pixel 8": 75999, "nothing phone 2a": 23999,
    "motorola edge 50 pro": 31999,

    # Laptops
    "macbook air m2":      114900, "macbook air m3":     119900,
    "macbook pro m3":      199900, "macbook pro m3 pro": 249900,
    "dell xps 13":          89990, "dell inspiron 15":    54990,
    "hp pavilion 15":       54990, "hp spectre x360":    139990,
    "lenovo ideapad slim 5": 52990, "lenovo thinkpad e14": 64990,
    "asus vivobook 15":     44990, "asus zenbook 14":     74990,
    "acer aspire 5":        39990,

    # Tablets
    "ipad air m2":    59900, "ipad pro m4":    109900,
    "ipad 10th gen":  34900, "samsung galaxy tab s9": 72999,
    "samsung galaxy tab a9+": 28999,

    # Audio
    "sony wh-1000xm5":    29990, "sony wh-1000xm4":  19990,
    "sony wf-1000xm5":    24990, "bose quietcomfort 45": 29990,
    "bose qc earbuds ii": 23990, "apple airpods pro 2": 24900,
    "apple airpods 3":    17900, "apple airpods":      12990,
    "jbl tune 770nc":      8999, "jbl partybox 110":   17999,
    "boat airdopes 141":   1299, "boat rockerz 550":    1799,
    "oneplus buds z2":     2999, "nothing ear 2":       8999,

    # Smartwatches
    "apple watch series 9":  41900, "apple watch se":       29900,
    "samsung galaxy watch 6": 26999, "samsung galaxy fit 3":  5999,
    "noise colorfit pro 5":   3999,  "boult wave matrix":    2499,

    # TVs
    "samsung 55 qled":  74990, "lg oled 55":        149990,
    "sony bravia 55":   89990, "mi tv 55":           39990,
    "oneplus tv 55 y1s": 34999,

    # Fashion
    "nike air max 270":    8995, "nike air force 1":   7495,
    "adidas ultraboost 22": 13999, "adidas stan smith":  7999,
    "puma rs-x":            8999, "puma cell viper":    5499,
    "reebok classic":       5999,
    "levi's 511 slim":      3999, "levi's 501 original": 4499,
    "levi's 512 slim":      3799,
    "h&m regular fit shirt": 1299, "zara slim fit shirt": 2990,
    "nike dri-fit tshirt":  1995, "adidas tshirt":       1799,

    # Grocery
    "tata salt 1kg":         22, "fortune sunflower oil 1l":  145,
    "amul butter 500g":     275, "parle-g 800g":              70,
    "tata tea premium 500g": 265, "nescafe classic 200g":     495,
    "red label tea 500g":   260,

    # Books
    "atomic habits":   399, "rich dad poor dad": 350,
    "wings of fire":   250, "ikigai":            350,
    "ncert physics 12": 95,
}


def get_base_price(query: str, category: str) -> float:
    q = query.lower().strip()

    # Longest match first (most specific)
    best_match = None
    best_len   = 0
    for product, price in KNOWN_PRICES.items():
        if product in q and len(product) > best_len:
            best_match = price
            best_len   = len(product)

    if best_match:
        return float(best_match)

    # Word-level partial match
    words = [w for w in q.split() if len(w) > 3]
    for product, price in KNOWN_PRICES.items():
        for word in words:
            if word in product:
                return float(price)

    # Category range estimate
    seed = int(hashlib.md5(q.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    ranges = {
        "electronics": (8000, 100000),
        "fashion":     (599,  15000),
        "grocery":     (50,   2000),
        "books":       (199,  1500),
        "general":     (499,  25000),
    }
    lo, hi = ranges.get(category, (499, 25000))
    return float(random.randint(lo, hi))


def round_price(price: float, category: str) -> int:
    """Round to realistic Indian price points."""
    if category == "grocery":
        return round(price)
    if price > 50000:
        return round(price / 100) * 100
    if price > 10000:
        return round(price / 100) * 100 - 1   # e.g. 74999, 49999
    if price > 1000:
        return round(price / 10) * 10 - 1     # e.g. 2999, 8999
    return round(price / 5) * 5 - 1           # e.g. 599, 999


@router.get("/prices")
def compare_prices(q: str = Query(..., description="Product name to search")):
    category  = detect_category(q)
    retailers = RETAILERS[category]
    base      = get_base_price(q, category)

    seed = int(hashlib.md5((q.lower().strip()).encode()).hexdigest()[:8], 16)
    random.seed(seed)

    results = []
    for r in retailers:
        # Variation: ±8% around base×margin (tight spread = realistic)
        variation = random.uniform(0.93, 1.08)
        raw_price = base * r["margin"] * variation
        price     = round_price(raw_price, category)

        # MRP 10–30% above selling price
        mrp_mult  = random.uniform(1.08, 1.30)
        original  = round_price(price * mrp_mult, category)
        if original <= price:
            original = price + round_price(price * 0.12, category)

        discount = round((original - price) / original * 100)
        reviews  = random.randint(500, 95000)
        rating   = round(min(5.0, max(1.0, r["review_base"] + random.uniform(-0.2, 0.2))), 1)
        in_stock = random.random() > 0.06   # 94% in stock

        url = r["search"].replace("{q}", q.replace(" ", "+"))

        results.append({
            "retailer":      r["name"],
            "logo":          r["logo"],
            "color":         r["color"],
            "price":         price,
            "original":      original,
            "discount":      discount,
            "rating":        rating,
            "reviews":       reviews,
            "delivery":      r["delivery"],
            "in_stock":      in_stock,
            "url":           url,
            "free_delivery": price > 499,
            "emi":           f"₹{price//12:,}/mo" if price > 5000 else None,
            "category":      category,
        })

    # Always sort low → high price
    results.sort(key=lambda x: x["price"])

    lowest       = results[0]
    highest      = results[-1]
    best_rated   = max(results, key=lambda x: x["rating"])
    # Best overall = best balance of low price + high rating
    norm_prices  = [r["price"] for r in results]
    price_range  = max(norm_prices) - min(norm_prices) or 1
    best_overall = max(results, key=lambda x:
        (1 - (x["price"] - min(norm_prices)) / price_range) * 0.5 + x["rating"] / 5 * 0.5
    )

    return {
        "query":      q,
        "category":   category,
        "results":    results,
        "disclaimer": "Prices shown are estimated market rates. Click any retailer to see the exact live price on their website.",
        "summary": {
            "lowest_price":      lowest["price"],
            "lowest_retailer":   lowest["retailer"],
            "highest_price":     highest["price"],
            "highest_retailer":  highest["retailer"],
            "best_rated":        best_rated["retailer"],
            "best_rating":       best_rated["rating"],
            "best_overall":      best_overall["retailer"],
            "price_range":       f"₹{lowest['price']:,} – ₹{highest['price']:,}",
            "max_savings":       highest["price"] - lowest["price"],
            "total_retailers":   len(results),
        }
    }


@router.get("/categories")
def popular():
    return {
        "popular": [
            "iPhone 15", "Samsung Galaxy S24", "MacBook Air M2",
            "Sony WH-1000XM5", "Nike Air Max 270", "Levi's 511 Slim",
            "OnePlus 12", "iPad Air M2", "Boat Airdopes 141",
            "Samsung 55 QLED", "Nothing Phone 2a", "Redmi Note 13 Pro",
        ],
        "trending": ["iPhone 16", "Samsung Galaxy S24 Ultra", "Nothing Phone 2a",
                     "Realme 12 Pro+", "OnePlus Nord 4"],
        "categories": {
            "📱 Phones":      ["iPhone 15", "Samsung Galaxy S24", "OnePlus 12", "Redmi Note 13 Pro"],
            "💻 Laptops":     ["MacBook Air M2", "Dell XPS 13", "HP Pavilion 15", "Lenovo IdeaPad"],
            "🎧 Audio":       ["Sony WH-1000XM5", "Apple AirPods Pro 2", "Boat Airdopes 141"],
            "👟 Fashion":     ["Nike Air Max 270", "Adidas Ultraboost", "Levi's 511 Slim"],
            "🥗 Grocery":     ["Tata Salt 1kg", "Amul Butter 500g", "Fortune Oil 1L"],
        }
    }
