/**
 * Mapping delle icone Lucide React con keywords semantiche per migliorare la ricerca
 * Basato su lucide.dev e use cases comuni per expense tracking
 */

export interface IconMetadata {
  name: string;
  keywords: string[];
  category: string;
}

export const iconKeywords: Record<string, IconMetadata> = {
  // 🛒 Shopping & Retail
  "ShoppingCart": {
    name: "ShoppingCart",
    keywords: ["shopping", "cart", "trolley", "supermarket", "grocery", "store", "buy", "purchase", "spesa", "carrello", "supermercato"],
    category: "shopping"
  },
  "ShoppingBag": {
    name: "ShoppingBag", 
    keywords: ["shopping", "bag", "retail", "store", "purchase", "buy", "borsa", "spesa", "negozio"],
    category: "shopping"
  },
  "ShoppingBasket": {
    name: "ShoppingBasket",
    keywords: ["shopping", "basket", "groceries", "supermarket", "food", "cestino", "spesa", "alimentari"],
    category: "shopping"
  },
  "Store": {
    name: "Store",
    keywords: ["store", "shop", "retail", "business", "negozio", "attività", "commercio"],
    category: "shopping"
  },
  "Truck": {
    name: "Truck", 
    keywords: ["truck", "delivery", "transport", "cargo", "trolley", "camion", "consegna", "trasporto", "carico"],
    category: "transport"
  },
  "Package": {
    name: "Package",
    keywords: ["package", "box", "delivery", "shipping", "pacco", "scatola", "consegna", "spedizione"],
    category: "shopping"
  },
  "Luggage": {
    name: "Luggage",
    keywords: ["luggage", "suitcase", "travel", "trolley", "baggage", "valigia", "viaggio", "bagaglio"],
    category: "transport"
  },

  // 🍕 Food & Dining
  "UtensilsCrossed": {
    name: "UtensilsCrossed",
    keywords: ["food", "eat", "dining", "restaurant", "meal", "utensils", "fork", "knife", "cibo", "mangiare", "ristorante", "posate"],
    category: "food"
  },
  "Coffee": {
    name: "Coffee",
    keywords: ["coffee", "drink", "cafe", "beverage", "caffè", "bar", "bevanda"],
    category: "food"
  },
  "Pizza": {
    name: "Pizza", 
    keywords: ["pizza", "food", "italian", "restaurant", "fast food", "cibo", "italiano", "ristorante"],
    category: "food"
  },
  "Wine": {
    name: "Wine",
    keywords: ["wine", "alcohol", "drink", "restaurant", "vino", "alcol", "bevanda", "ristorante"],
    category: "food"
  },
  "IceCream": {
    name: "IceCream",
    keywords: ["ice cream", "dessert", "sweet", "gelato", "dolce", "dessert"],
    category: "food"
  },

  // 🚗 Transportation
  "Car": {
    name: "Car",
    keywords: ["car", "vehicle", "transport", "auto", "drive", "automotive", "macchina", "automobile", "trasporto", "guidare"],
    category: "transport"
  },
  "Bus": {
    name: "Bus",
    keywords: ["bus", "public transport", "travel", "autobus", "trasporto pubblico", "viaggio"],
    category: "transport"
  },
  "Train": {
    name: "Train", 
    keywords: ["train", "railway", "transport", "travel", "treno", "ferrovia", "trasporto", "viaggio"],
    category: "transport"
  },
  "Plane": {
    name: "Plane",
    keywords: ["plane", "airplane", "flight", "travel", "aereo", "volo", "viaggio"],
    category: "transport"
  },
  "Bike": {
    name: "Bike",
    keywords: ["bike", "bicycle", "cycling", "transport", "bici", "bicicletta", "ciclismo", "trasporto"],
    category: "transport"
  },
  "Fuel": {
    name: "Fuel",
    keywords: ["fuel", "gas", "petrol", "gasoline", "benzina", "carburante", "gas"],
    category: "transport"
  },
  "ParkingCircle": {
    name: "ParkingCircle",
    keywords: ["parking", "car", "vehicle", "parcheggio", "auto", "veicolo"],
    category: "transport"
  },

  // 🏠 Home & Living
  "Home": {
    name: "Home",
    keywords: ["home", "house", "residence", "living", "casa", "abitazione", "dimora"],
    category: "home"
  },
  "Bed": {
    name: "Bed",
    keywords: ["bed", "sleep", "bedroom", "furniture", "letto", "dormire", "camera", "arredamento"],
    category: "home"
  },
  "Sofa": {
    name: "Sofa", 
    keywords: ["sofa", "couch", "furniture", "living room", "divano", "arredamento", "soggiorno"],
    category: "home"
  },
  "Lightbulb": {
    name: "Lightbulb",
    keywords: ["light", "bulb", "electricity", "illumination", "luce", "lampadina", "elettricità", "illuminazione"],
    category: "home"
  },
  "Zap": {
    name: "Zap",
    keywords: ["electricity", "power", "energy", "electric", "elettricità", "energia", "corrente"],
    category: "home"
  },
  "Droplets": {
    name: "Droplets",
    keywords: ["water", "droplets", "liquid", "acqua", "gocce", "liquido"],
    category: "home"
  },

  // 💊 Health & Medical
  "Heart": {
    name: "Heart",
    keywords: ["health", "medical", "heart", "cardio", "love", "salute", "medico", "cuore", "amore"],
    category: "health"
  },
  "Pill": {
    name: "Pill",
    keywords: ["medicine", "pill", "pharmacy", "health", "drug", "medicina", "pillola", "farmacia", "salute"],
    category: "health"
  },
  "Stethoscope": {
    name: "Stethoscope",
    keywords: ["medical", "doctor", "health", "stethoscope", "medico", "dottore", "salute", "stetoscopio"],
    category: "health"
  },
  "Activity": {
    name: "Activity",
    keywords: ["activity", "health", "fitness", "exercise", "attività", "salute", "fitness", "esercizio"],
    category: "health"
  },

  // 💰 Finance & Money
  "DollarSign": {
    name: "DollarSign",
    keywords: ["money", "dollar", "finance", "currency", "payment", "soldi", "dollaro", "finanza", "valuta", "pagamento"],
    category: "finance"
  },
  "Euro": {
    name: "Euro",
    keywords: ["money", "euro", "finance", "currency", "payment", "soldi", "finanza", "valuta", "pagamento"],
    category: "finance"
  },
  "PoundSterling": {
    name: "PoundSterling", 
    keywords: ["money", "pound", "sterling", "finance", "currency", "soldi", "sterlina", "finanza", "valuta"],
    category: "finance"
  },
  "CreditCard": {
    name: "CreditCard",
    keywords: ["card", "credit", "payment", "finance", "bank", "carta", "credito", "pagamento", "banca"],
    category: "finance"
  },
  "Banknote": {
    name: "Banknote",
    keywords: ["money", "cash", "banknote", "finance", "soldi", "contanti", "banconota", "finanza"],
    category: "finance"
  },
  "Coins": {
    name: "Coins",
    keywords: ["money", "coins", "change", "finance", "soldi", "monete", "spiccioli", "finanza"],
    category: "finance"
  },
  "Wallet": {
    name: "Wallet",
    keywords: ["wallet", "money", "finance", "cash", "portafoglio", "soldi", "finanza", "contanti"],
    category: "finance"
  },
  "Receipt": {
    name: "Receipt",
    keywords: ["receipt", "bill", "payment", "invoice", "scontrino", "conto", "pagamento", "fattura"],
    category: "finance"
  },

  // 🎮 Entertainment
  "Gamepad2": {
    name: "Gamepad2",
    keywords: ["gaming", "games", "entertainment", "play", "gamepad", "giochi", "intrattenimento", "giocare"],
    category: "entertainment"
  },
  "Music": {
    name: "Music",
    keywords: ["music", "audio", "sound", "entertainment", "musica", "suono", "intrattenimento"],
    category: "entertainment"
  },
  "Headphones": {
    name: "Headphones",
    keywords: ["headphones", "music", "audio", "sound", "cuffie", "musica", "suono"],
    category: "entertainment"
  },
  "Film": {
    name: "Film",
    keywords: ["movie", "film", "cinema", "entertainment", "video", "cinema", "intrattenimento"],
    category: "entertainment"
  },
  "Camera": {
    name: "Camera",
    keywords: ["camera", "photo", "photography", "picture", "fotografia", "foto", "immagine"],
    category: "entertainment"
  },

  // 📚 Education & Work
  "GraduationCap": {
    name: "GraduationCap",
    keywords: ["education", "graduation", "school", "university", "learning", "educazione", "laurea", "scuola", "università"],
    category: "education"
  },
  "Book": {
    name: "Book",
    keywords: ["book", "reading", "education", "literature", "libro", "lettura", "educazione", "letteratura"],
    category: "education"
  },
  "Briefcase": {
    name: "Briefcase",
    keywords: ["work", "business", "office", "professional", "lavoro", "ufficio", "professionale", "valigetta"],
    category: "education"
  },
  "Laptop": {
    name: "Laptop",
    keywords: ["computer", "laptop", "technology", "work", "computing", "computer", "tecnologia", "lavoro"],
    category: "education"
  },

  // 🎨 Lifestyle & Hobbies
  "Palette": {
    name: "Palette", 
    keywords: ["art", "painting", "colors", "creative", "palette", "arte", "pittura", "colori", "creativo"],
    category: "lifestyle"
  },
  "PaintRoller": {
    name: "PaintRoller",
    keywords: ["paint", "painting", "home improvement", "diy", "roller", "verniciare", "pittura", "rullo", "casa"],
    category: "lifestyle"
  },
  "Scissors": {
    name: "Scissors",
    keywords: ["scissors", "cut", "craft", "tools", "forbici", "tagliare", "artigianato", "strumenti"],
    category: "lifestyle"
  },
  "Shirt": {
    name: "Shirt",
    keywords: ["clothes", "clothing", "fashion", "shirt", "wear", "vestiti", "abbigliamento", "moda", "camicia"],
    category: "lifestyle"
  },

  // 🧰 Tools & Utilities
  "Wrench": {
    name: "Wrench",
    keywords: ["tools", "repair", "maintenance", "fix", "strumenti", "riparazione", "manutenzione", "aggiustare"],
    category: "tools"
  },
  "Hammer": {
    name: "Hammer",
    keywords: ["tools", "construction", "build", "hammer", "strumenti", "costruzione", "martello"],
    category: "tools"
  },
  "Settings": {
    name: "Settings",
    keywords: ["settings", "configuration", "options", "preferences", "impostazioni", "configurazione", "opzioni"],
    category: "tools"
  },

  // 🌿 Nature & Environment
  "Trees": {
    name: "Trees",
    keywords: ["nature", "trees", "environment", "green", "forest", "natura", "alberi", "ambiente", "verde", "foresta"],
    category: "nature"
  },
  "Flower": {
    name: "Flower",
    keywords: ["nature", "flower", "garden", "plant", "natura", "fiore", "giardino", "pianta"],
    category: "nature"
  },
  "Sun": {
    name: "Sun",
    keywords: ["sun", "weather", "sunny", "light", "sole", "tempo", "soleggiato", "luce"],
    category: "nature"
  },

  // 🏥 Services & Buildings
  "Hospital": {
    name: "Hospital",
    keywords: ["hospital", "medical", "health", "emergency", "ospedale", "medico", "salute", "emergenza"],
    category: "services"
  },
  "School": {
    name: "School",
    keywords: ["school", "education", "learning", "building", "scuola", "educazione", "apprendimento"],
    category: "services"
  },
  "Building": {
    name: "Building",
    keywords: ["building", "office", "business", "structure", "edificio", "ufficio", "struttura"],
    category: "services"
  },

  // 🎁 Special Occasions
  "Gift": {
    name: "Gift",
    keywords: ["gift", "present", "celebration", "birthday", "regalo", "presente", "celebrazione", "compleanno"],
    category: "special"
  },
  "PartyPopper": {
    name: "PartyPopper",
    keywords: ["party", "celebration", "fun", "festa", "celebrazione", "divertimento"],
    category: "special"
  },

  // 🔤 Text & Typography
  "Type": {
    name: "Type",
    keywords: ["text", "type", "typography", "font", "testo", "carattere", "tipografia"],
    category: "text"
  },
  "AlignLeft": {
    name: "AlignLeft",
    keywords: ["align", "left", "text", "alignment", "allinea", "sinistra", "testo"],
    category: "text"
  },
  "AlignCenter": {
    name: "AlignCenter",
    keywords: ["align", "center", "text", "alignment", "allinea", "centro", "testo"],
    category: "text"
  },
  "AlignRight": {
    name: "AlignRight",
    keywords: ["align", "right", "text", "alignment", "allinea", "destra", "testo"],
    category: "text"
  },
  "AlignJustify": {
    name: "AlignJustify",
    keywords: ["align", "justify", "text", "alignment", "allinea", "giustifica", "testo"],
    category: "text"
  },
  "Bold": {
    name: "Bold",
    keywords: ["bold", "text", "format", "grassetto", "testo", "formato"],
    category: "text"
  },
  "Italic": {
    name: "Italic",
    keywords: ["italic", "text", "format", "corsivo", "testo", "formato"],
    category: "text"
  },
  "Underline": {
    name: "Underline",
    keywords: ["underline", "text", "format", "sottolineato", "testo", "formato"],
    category: "text"
  },

  // 🌐 Communication & Social
  "MessageCircle": {
    name: "MessageCircle",
    keywords: ["message", "chat", "communication", "talk", "messaggio", "chat", "comunicazione"],
    category: "communication"
  },
  "MessageSquare": {
    name: "MessageSquare",
    keywords: ["message", "chat", "communication", "talk", "messaggio", "chat", "comunicazione"],
    category: "communication"
  },
  "Phone": {
    name: "Phone",
    keywords: ["phone", "call", "telephone", "communication", "telefono", "chiamata", "comunicazione"],
    category: "communication"
  },
  "PhoneCall": {
    name: "PhoneCall",
    keywords: ["phone", "call", "telephone", "communication", "telefono", "chiamata", "comunicazione"],
    category: "communication"
  },
  "Video": {
    name: "Video",
    keywords: ["video", "camera", "recording", "multimedia", "filmato", "registrazione"],
    category: "communication"
  },
  "Microphone": {
    name: "Microphone",
    keywords: ["microphone", "audio", "sound", "record", "microfono", "audio", "suono", "registra"],
    category: "communication"
  },
  "MicrophoneOff": {
    name: "MicrophoneOff",
    keywords: ["microphone", "mute", "audio", "sound", "off", "microfono", "muto", "spento"],
    category: "communication"
  },

  // 📱 Devices & Technology
  "Smartphone": {
    name: "Smartphone",
    keywords: ["smartphone", "mobile", "device", "phone", "cellulare", "dispositivo", "telefono"],
    category: "devices"
  },
  "Tablet": {
    name: "Tablet",
    keywords: ["tablet", "device", "mobile", "ipad", "dispositivo", "mobile"],
    category: "devices"
  },
  "Monitor": {
    name: "Monitor",
    keywords: ["monitor", "screen", "display", "computer", "schermo", "display", "computer"],
    category: "devices"
  },
  "Tv": {
    name: "Tv",
    keywords: ["tv", "television", "screen", "display", "televisione", "schermo"],
    category: "devices"
  },
  "Wifi": {
    name: "Wifi",
    keywords: ["wifi", "wireless", "internet", "connection", "senza fili", "connessione"],
    category: "devices"
  },
  "WifiOff": {
    name: "WifiOff",
    keywords: ["wifi", "wireless", "off", "disconnected", "senza fili", "disconnesso"],
    category: "devices"
  },
  "Bluetooth": {
    name: "Bluetooth",
    keywords: ["bluetooth", "wireless", "connection", "pairing", "senza fili", "connessione"],
    category: "devices"
  },
  "Battery": {
    name: "Battery",
    keywords: ["battery", "power", "energy", "charge", "batteria", "energia", "carica"],
    category: "devices"
  },
  "BatteryLow": {
    name: "BatteryLow",
    keywords: ["battery", "low", "power", "energy", "batteria", "scarica", "energia"],
    category: "devices"
  },
  "Power": {
    name: "Power",
    keywords: ["power", "on", "off", "electricity", "energia", "acceso", "spento"],
    category: "devices"
  },
  "PowerOff": {
    name: "PowerOff",
    keywords: ["power", "off", "shutdown", "spegnere", "energia", "spento"],
    category: "devices"
  },

  // ⚡ Actions & Operations
  "Play": {
    name: "Play",
    keywords: ["play", "start", "begin", "multimedia", "riproduci", "inizia", "multimedia"],
    category: "actions"
  },
  "Pause": {
    name: "Pause",
    keywords: ["pause", "stop", "break", "multimedia", "pausa", "ferma", "multimedia"],
    category: "actions"
  },
  "Stop": {
    name: "Stop",
    keywords: ["stop", "end", "halt", "multimedia", "ferma", "fine", "multimedia"],
    category: "actions"
  },
  "SkipForward": {
    name: "SkipForward",
    keywords: ["skip", "forward", "next", "multimedia", "salta", "avanti", "prossimo"],
    category: "actions"
  },
  "SkipBack": {
    name: "SkipBack",
    keywords: ["skip", "back", "previous", "multimedia", "salta", "indietro", "precedente"],
    category: "actions"
  },
  "Rewind": {
    name: "Rewind",
    keywords: ["rewind", "back", "reverse", "multimedia", "riavvolgi", "indietro"],
    category: "actions"
  },
  "FastForward": {
    name: "FastForward",
    keywords: ["fast", "forward", "speed", "multimedia", "veloce", "avanti", "velocità"],
    category: "actions"
  },
  "Volume2": {
    name: "Volume2",
    keywords: ["volume", "sound", "audio", "loud", "volume", "suono", "audio", "alto"],
    category: "actions"
  },
  "Volume1": {
    name: "Volume1",
    keywords: ["volume", "sound", "audio", "medium", "volume", "suono", "audio", "medio"],
    category: "actions"
  },
  "VolumeX": {
    name: "VolumeX",
    keywords: ["volume", "mute", "silent", "audio", "muto", "silenzioso"],
    category: "actions"
  },

  // 🎯 Interface Elements
  "Menu": {
    name: "Menu",
    keywords: ["menu", "navigation", "hamburger", "list", "navigazione", "lista"],
    category: "interface"
  },
  "MoreHorizontal": {
    name: "MoreHorizontal",
    keywords: ["more", "options", "horizontal", "dots", "altro", "opzioni", "punti"],
    category: "interface"
  },
  "MoreVertical": {
    name: "MoreVertical",
    keywords: ["more", "options", "vertical", "dots", "altro", "opzioni", "punti"],
    category: "interface"
  },
  "Grid": {
    name: "Grid",
    keywords: ["grid", "layout", "table", "matrix", "griglia", "tabella", "matrice"],
    category: "interface"
  },
  "List": {
    name: "List",
    keywords: ["list", "items", "menu", "navigation", "lista", "elementi", "navigazione"],
    category: "interface"
  },
  "Layers": {
    name: "Layers",
    keywords: ["layers", "stack", "depth", "design", "livelli", "strati", "design"],
    category: "interface"
  },
  "Filter": {
    name: "Filter",
    keywords: ["filter", "search", "sort", "organize", "filtro", "cerca", "ordina"],
    category: "interface"
  },
  "Search": {
    name: "Search",
    keywords: ["search", "find", "look", "magnify", "cerca", "trova", "lente"],
    category: "interface"
  },

  // 🏭 Business & Work
  "Building2": {
    name: "Building2",
    keywords: ["building", "office", "company", "business", "edificio", "ufficio", "azienda"],
    category: "business"
  },
  "Factory": {
    name: "Factory",
    keywords: ["factory", "industry", "manufacturing", "production", "fabbrica", "industria", "produzione"],
    category: "business"
  },
  "Landmark": {
    name: "Landmark",
    keywords: ["landmark", "building", "monument", "architecture", "monumento", "architettura"],
    category: "business"
  },

  // 📊 Charts & Analytics
  "BarChart": {
    name: "BarChart",
    keywords: ["chart", "bar", "graph", "data", "analytics", "grafico", "barre", "dati"],
    category: "charts"
  },
  "BarChart2": {
    name: "BarChart2",
    keywords: ["chart", "bar", "graph", "data", "analytics", "grafico", "barre", "dati"],
    category: "charts"
  },
  "BarChart3": {
    name: "BarChart3",
    keywords: ["chart", "bar", "graph", "data", "analytics", "grafico", "barre", "dati"],
    category: "charts"
  },
  "LineChart": {
    name: "LineChart",
    keywords: ["chart", "line", "graph", "data", "trend", "grafico", "linea", "dati", "trend"],
    category: "charts"
  },
  "PieChart": {
    name: "PieChart",
    keywords: ["chart", "pie", "graph", "data", "percentage", "grafico", "torta", "percentuale"],
    category: "charts"
  },
  "TrendingUp": {
    name: "TrendingUp",
    keywords: ["trending", "up", "growth", "increase", "crescita", "aumento", "su"],
    category: "charts"
  },
  "TrendingDown": {
    name: "TrendingDown",
    keywords: ["trending", "down", "decline", "decrease", "calo", "diminuzione", "giù"],
    category: "charts"
  },

  // ⏰ Time & Calendar
  "Clock": {
    name: "Clock",
    keywords: ["clock", "time", "hour", "schedule", "orologio", "tempo", "ora"],
    category: "time"
  },
  "Calendar": {
    name: "Calendar",
    keywords: ["calendar", "date", "schedule", "time", "calendario", "data", "programma"],
    category: "time"
  },
  "CalendarDays": {
    name: "CalendarDays",
    keywords: ["calendar", "days", "date", "schedule", "calendario", "giorni", "data"],
    category: "time"
  },
  "Timer": {
    name: "Timer",
    keywords: ["timer", "countdown", "time", "clock", "timer", "conto alla rovescia", "tempo"],
    category: "time"
  },
  "Stopwatch": {
    name: "Stopwatch",
    keywords: ["stopwatch", "timer", "time", "measure", "cronometro", "tempo", "misura"],
    category: "time"
  },
  "AlarmClock": {
    name: "AlarmClock",
    keywords: ["alarm", "clock", "wake", "time", "sveglia", "orologio", "tempo"],
    category: "time"
  },

  // 🌍 Location & Maps
  "MapPin": {
    name: "MapPin",
    keywords: ["map", "pin", "location", "place", "marker", "mappa", "posizione", "luogo"],
    category: "location"
  },
  "Map": {
    name: "Map",
    keywords: ["map", "navigation", "location", "geography", "mappa", "navigazione", "geografia"],
    category: "location"
  },
  "Navigation": {
    name: "Navigation",
    keywords: ["navigation", "direction", "compass", "guide", "navigazione", "direzione", "bussola"],
    category: "location"
  },
  "Compass": {
    name: "Compass",
    keywords: ["compass", "direction", "navigation", "north", "bussola", "direzione", "nord"],
    category: "location"
  },
  "Globe": {
    name: "Globe",
    keywords: ["globe", "world", "earth", "planet", "internet", "globo", "mondo", "terra"],
    category: "location"
  },

  // 🔧 System & Settings
  "Cog": {
    name: "Cog",
    keywords: ["cog", "settings", "gear", "configuration", "ingranaggio", "impostazioni", "configurazione"],
    category: "system"
  },
  "Sliders": {
    name: "Sliders",
    keywords: ["sliders", "controls", "settings", "adjust", "cursori", "controlli", "regola"],
    category: "system"
  },
  "SlidersHorizontal": {
    name: "SlidersHorizontal",
    keywords: ["sliders", "controls", "settings", "horizontal", "cursori", "controlli", "orizzontale"],
    category: "system"
  },
  "ToggleLeft": {
    name: "ToggleLeft",
    keywords: ["toggle", "switch", "off", "disable", "interruttore", "spento", "disabilita"],
    category: "system"
  },
  "ToggleRight": {
    name: "ToggleRight",
    keywords: ["toggle", "switch", "on", "enable", "interruttore", "acceso", "abilita"],
    category: "system"
  },

  // 🔒 Security & Privacy
  "Lock": {
    name: "Lock",
    keywords: ["lock", "secure", "private", "password", "blocco", "sicuro", "privato"],
    category: "security"
  },
  "Unlock": {
    name: "Unlock",
    keywords: ["unlock", "open", "access", "password", "sblocca", "apri", "accesso"],
    category: "security"
  },
  "Key": {
    name: "Key",
    keywords: ["key", "password", "access", "secure", "chiave", "password", "accesso"],
    category: "security"
  },
  "Shield": {
    name: "Shield",
    keywords: ["shield", "protection", "security", "safe", "scudo", "protezione", "sicurezza"],
    category: "security"
  },
  "ShieldCheck": {
    name: "ShieldCheck",
    keywords: ["shield", "check", "verified", "secure", "safe", "scudo", "verificato", "sicuro"],
    category: "security"
  },
  "Eye": {
    name: "Eye",
    keywords: ["eye", "view", "see", "visible", "watch", "occhio", "vedi", "visibile"],
    category: "security"
  },
  "EyeOff": {
    name: "EyeOff",
    keywords: ["eye", "hidden", "invisible", "hide", "private", "occhio", "nascosto", "privato"],
    category: "security"
  },

  // 🎨 Design & Creative
  "Paintbrush": {
    name: "Paintbrush",
    keywords: ["paintbrush", "paint", "art", "design", "brush", "pennello", "pittura", "arte"],
    category: "design"
  },
  "Paintbrush2": {
    name: "Paintbrush2",
    keywords: ["paintbrush", "paint", "art", "design", "brush", "pennello", "pittura", "arte"],
    category: "design"
  },
  "Pen": {
    name: "Pen",
    keywords: ["pen", "write", "edit", "draw", "penna", "scrivi", "modifica", "disegna"],
    category: "design"
  },
  "PenTool": {
    name: "PenTool",
    keywords: ["pen", "tool", "draw", "design", "vector", "penna", "strumento", "disegna"],
    category: "design"
  },
  "Pencil": {
    name: "Pencil",
    keywords: ["pencil", "draw", "sketch", "edit", "matita", "disegna", "schizzo", "modifica"],
    category: "design"
  },
  "Eraser": {
    name: "Eraser",
    keywords: ["eraser", "delete", "remove", "clean", "gomma", "cancella", "rimuovi"],
    category: "design"
  },
  "Crop": {
    name: "Crop",
    keywords: ["crop", "cut", "trim", "resize", "ritaglia", "taglia", "ridimensiona"],
    category: "design"
  },
  "Move": {
    name: "Move",
    keywords: ["move", "drag", "position", "relocate", "muovi", "trascina", "posizione"],
    category: "design"
  },
  "RotateCw": {
    name: "RotateCw",
    keywords: ["rotate", "clockwise", "turn", "spin", "ruota", "orario", "gira"],
    category: "design"
  },
  "RotateCcw": {
    name: "RotateCcw",
    keywords: ["rotate", "counterclockwise", "turn", "spin", "ruota", "antiorario", "gira"],
    category: "design"
  },
  "FlipHorizontal": {
    name: "FlipHorizontal",
    keywords: ["flip", "horizontal", "mirror", "reverse", "capovolgi", "orizzontale", "specchia"],
    category: "design"
  },
  "FlipVertical": {
    name: "FlipVertical",
    keywords: ["flip", "vertical", "mirror", "reverse", "capovolgi", "verticale", "specchia"],
    category: "design"
  }
};

/**
 * Sistema di generazione automatica di keywords per icone non mappate
 */
export function generateAutomaticKeywords(iconName: string): string[] {
  const keywords: string[] = [];
  
  // Splitta il nome dell'icona in PascalCase
  const words = iconName.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
  keywords.push(...words);
  
  // Aggiungi varianti comuni
  words.forEach(word => {
    // Plurali/singolari
    if (word.endsWith('s') && word.length > 3) {
      keywords.push(word.slice(0, -1)); // rimuovi 's'
    } else if (!word.endsWith('s')) {
      keywords.push(word + 's'); // aggiungi 's'
    }
    
    // Varianti con suffissi comuni
    if (word.endsWith('ed')) {
      keywords.push(word.slice(0, -2)); // rimuovi 'ed'
    }
    if (word.endsWith('ing')) {
      keywords.push(word.slice(0, -3)); // rimuovi 'ing'
    }
  });
  
  // Traduzioni italiane basiche per parole comuni
  const translations: Record<string, string[]> = {
    'home': ['casa', 'dimora'],
    'user': ['utente', 'persona'],
    'file': ['file', 'documento'],
    'folder': ['cartella', 'directory'],
    'edit': ['modifica', 'modifica'],
    'delete': ['cancella', 'elimina'],
    'add': ['aggiungi', 'inserisci'],
    'remove': ['rimuovi', 'togli'],
    'search': ['cerca', 'trova'],
    'save': ['salva', 'conserva'],
    'open': ['apri', 'spalanca'],
    'close': ['chiudi', 'serra'],
    'copy': ['copia', 'duplica'],
    'cut': ['taglia', 'ritaglia'],
    'paste': ['incolla', 'attacca'],
    'send': ['invia', 'manda'],
    'download': ['scarica', 'download'],
    'upload': ['carica', 'upload'],
    'share': ['condividi', 'partecipa'],
    'print': ['stampa', 'stampa'],
    'email': ['email', 'posta'],
    'phone': ['telefono', 'chiamata'],
    'message': ['messaggio', 'comunicazione'],
    'time': ['tempo', 'ora'],
    'date': ['data', 'giorno'],
    'calendar': ['calendario', 'agenda'],
    'clock': ['orologio', 'tempo'],
    'star': ['stella', 'preferito'],
    'heart': ['cuore', 'amore'],
    'like': ['mi piace', 'gradire'],
    'dislike': ['non mi piace', 'non gradire']
  };
  
  words.forEach(word => {
    if (translations[word]) {
      keywords.push(...translations[word]);
    }
  });
  
  return [...new Set(keywords)]; // rimuovi duplicati
}

/**
 * Cerca icone basandosi sui nomi tecnici e sulle keywords semantiche
 */
export function searchIcons(availableIcons: string[], searchTerm: string): string[] {
  if (!searchTerm.trim()) {
    return availableIcons;
  }
  
  const searchLower = searchTerm.toLowerCase().trim();
  
  return availableIcons.filter(iconName => {
    // Ricerca nel nome tecnico dell'icona (comportamento originale)
    if (iconName.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Ricerca nelle keywords semantiche predefinite
    const metadata = iconKeywords[iconName];
    if (metadata) {
      return metadata.keywords.some(keyword => 
        keyword.toLowerCase().includes(searchLower)
      );
    }
    
    // Ricerca nelle keywords generate automaticamente per icone non mappate
    const autoKeywords = generateAutomaticKeywords(iconName);
    return autoKeywords.some(keyword => 
      keyword.toLowerCase().includes(searchLower)
    );
  });
}

/**
 * Ottiene le keywords per un'icona specifica (predefinite o generate automaticamente)
 */
export function getIconKeywords(iconName: string): string[] {
  const metadata = iconKeywords[iconName];
  if (metadata) {
    return metadata.keywords;
  }
  
  // Genera keywords automatiche per icone non mappate
  return generateAutomaticKeywords(iconName);
}

/**
 * Ottiene la categoria di un'icona
 */
export function getIconCategory(iconName: string): string {
  const metadata = iconKeywords[iconName];
  if (metadata) {
    return metadata.category;
  }
  
  // Inferisce categoria dall'icona non mappata
  return inferCategoryFromName(iconName);
}

/**
 * Inferisce la categoria di un'icona dal nome
 */
function inferCategoryFromName(iconName: string): string {
  const nameLower = iconName.toLowerCase();
  
  // Patterns per inferire categorie
  const categoryPatterns: Record<string, string[]> = {
    'communication': ['phone', 'message', 'chat', 'mail', 'call', 'mic', 'video'],
    'file': ['file', 'folder', 'document', 'pdf', 'image', 'download', 'upload'],
    'navigation': ['arrow', 'chevron', 'direction', 'move', 'next', 'previous'],
    'action': ['play', 'pause', 'stop', 'skip', 'forward', 'back', 'rewind'],
    'interface': ['menu', 'grid', 'list', 'filter', 'search', 'more', 'toggle'],
    'time': ['clock', 'calendar', 'time', 'date', 'timer', 'alarm'],
    'shopping': ['cart', 'shopping', 'store', 'shop', 'basket', 'bag', 'trolley'],
    'transport': ['car', 'truck', 'plane', 'train', 'bus', 'bike', 'ship'],
    'weather': ['sun', 'cloud', 'rain', 'snow', 'wind', 'storm'],
    'social': ['user', 'users', 'person', 'people', 'group', 'share'],
    'system': ['settings', 'cog', 'gear', 'option', 'config', 'setup'],
    'security': ['lock', 'unlock', 'key', 'shield', 'secure', 'private'],
    'health': ['heart', 'medical', 'hospital', 'pill', 'health', 'doctor'],
    'business': ['briefcase', 'building', 'office', 'work', 'company'],
    'finance': ['dollar', 'euro', 'money', 'coin', 'bank', 'payment', 'card'],
    'design': ['palette', 'brush', 'pen', 'pencil', 'crop', 'rotate'],
    'food': ['coffee', 'pizza', 'utensils', 'restaurant', 'food', 'drink'],
    'home': ['home', 'house', 'room', 'bed', 'door', 'window'],
    'entertainment': ['music', 'game', 'tv', 'radio', 'volume', 'speaker'],
    'tools': ['tool', 'hammer', 'wrench', 'screwdriver', 'fix', 'repair']
  };
  
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => nameLower.includes(pattern))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Ottiene tutte le categorie disponibili
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(iconKeywords).forEach(metadata => {
    categories.add(metadata.category);
  });
  return Array.from(categories).sort();
}

/**
 * Ottiene statistiche sui mapping delle icone
 */
export function getIconMappingStats(availableIcons: string[]): {
  total: number;
  mapped: number;
  unmapped: number;
  categories: Record<string, number>;
} {
  const mapped = availableIcons.filter(icon => iconKeywords[icon]).length;
  const unmapped = availableIcons.length - mapped;
  
  const categories: Record<string, number> = {};
  availableIcons.forEach(icon => {
    const category = getIconCategory(icon);
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return {
    total: availableIcons.length,
    mapped,
    unmapped,
    categories
  };
}

/**
 * Filtra icone per categoria
 */
export function filterIconsByCategory(availableIcons: string[], category: string): string[] {
  return availableIcons.filter(icon => getIconCategory(icon) === category);
} 