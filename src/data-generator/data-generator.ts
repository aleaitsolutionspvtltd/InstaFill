// @ts-nocheck
import RandExp from 'randexp';
/**
 * InstaFill - Data Generator
 * Provides highly realistic, region-profiled (US and India),
 * and semantically consistent mock datasets.
 */
class InstaFillDataGenerator {
  constructor() {
    // 1. UNITED STATES DATASET (High fidelity)
    this.us = {
      firstNames: [
        "Liam", "Olivia", "Noah", "Emma", "Oliver", "Ava", "Elijah", "Charlotte", "William", "Sophia",
        "James", "Amelia", "Benjamin", "Isabella", "Lucas", "Mia", "Henry", "Evelyn", "Alexander", "Harper",
        "Jack", "Aria", "Owen", "Penelope", "Theodore", "Chloe", "Samuel", "Grace", "David", "Victoria"
      ],
      lastNames: [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez",
        "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee"
      ],
      streetNames: [
        "Oak Avenue", "Pine Street", "Maple Drive", "Cedar Lane", "Elm Road", "Sunset Boulevard", "Broadway", "Park Lane"
      ],
      locations: [
        { state: "New York", code: "NY", cities: ["New York City", "Brooklyn", "Queens", "Buffalo", "Rochester"], zipMin: 10001, zipMax: 10025, timezone: "America/New_York" },
        { state: "California", code: "CA", cities: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Pasadena"], zipMin: 90001, zipMax: 90024, timezone: "America/Los_Angeles" },
        { state: "Texas", code: "TX", cities: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"], zipMin: 75001, zipMax: 75020, timezone: "America/Chicago" },
        { state: "Florida", code: "FL", cities: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"], zipMin: 33101, zipMax: 33125, timezone: "America/New_York" },
        { state: "Washington", code: "WA", cities: ["Seattle", "Bellevue", "Redmond", "Tacoma", "Olympia"], zipMin: 98101, zipMax: 98115, timezone: "America/Los_Angeles" }
      ],
      domains: ["yopmail.com"],
      companies: ["Acme Corp", "TechNova", "Starlight Industries", "VeloSystems", "NexusGlobal"]
    };

    // 2. INDIA DATASET (High fidelity)
    this.in = {
      firstNames: [
        "Amit", "Rahul", "Priya", "Sunita", "Rohan", "Ananya", "Vikram", "Deepika", "Aditya", "Neha",
        "Arjun", "Kiran", "Sanjay", "Meera", "Rajesh", "Pooja", "Vijay", "Aishwarya", "Suresh", "Kavita",
        "Abhishek", "Ritu", "Harish", "Divya", "Manoj", "Sneha", "Anil", "Jyoti", "Dinesh", "Preeti"
      ],
      lastNames: [
        "Sharma", "Doe", "Williams", "Verma", "Patel", "Reddy", "Iyer", "Sen", "Gupta", "Joshi",
        "Mehta", "Singh", "Kumar", "Nair", "Das", "Rao", "Pillai", "Choudhury", "Bose", "Trivedi"
      ],
      streetNames: [
        "Sector 62", "MG Road", "Brigade Road", "Linking Road", "Park Street", "Hitec City", "Gachibowli Road", "Anna Salai"
      ],
      locations: [
        { state: "Delhi", code: "DL", cities: ["New Delhi", "Dwarka", "Rohini", "Saket", "Vasant Kunj"], zipMin: 110001, zipMax: 110025, timezone: "Asia/Kolkata" },
        { state: "Maharashtra", code: "MH", cities: ["Mumbai", "Pune", "Nagpur", "Thane", "Navi Mumbai"], zipMin: 400001, zipMax: 400025, timezone: "Asia/Kolkata" },
        { state: "Karnataka", code: "KA", cities: ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi"], zipMin: 560001, zipMax: 560025, timezone: "Asia/Kolkata" },
        { state: "Tamil Nadu", code: "TN", cities: ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem"], zipMin: 600001, zipMax: 600025, timezone: "Asia/Kolkata" },
        { state: "Telangana", code: "TS", cities: ["Hyderabad", "Secunderabad", "Warangal", "Nizamabad", "Karimnagar"], zipMin: 500001, zipMax: 500025, timezone: "Asia/Kolkata" }
      ],
      domains: ["yopmail.com"],
      companies: ["Tata Enterprises", "Reliance Digital", "Infosys Technologies", "Wipro Global", "HDFC Ventures"]
    };

    // 3. GENERAL TEXTAREA TEMPLATES
    this.textareaTemplates = [
      "We are validating this form using the InstaFill browser extension. The execution context is running perfectly.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam.",
      "The automation pipeline triggered all change and input events successfully. Looking forward to conducting more automated testing passes.",
      "Please review our submission and feel free to reach out to me with any queries regarding this test run."
    ];

    // Establish random region profile
    this.region = Math.random() > 0.5 ? 'in' : 'us';
    this.dataset = this[this.region];
  }

  // Generate string from custom Regex
  regex(pattern) {
    try {
      const randexp = new RandExp(pattern);
      return randexp.gen();
    } catch (e) {
      return `[Regex Error: ${e.message}]`;
    }
  }

  _randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  firstName() {
    return this._randomItem(this.dataset.firstNames);
  }

  lastName() {
    return this._randomItem(this.dataset.lastNames);
  }

  fullName() {
    return `${this.firstName()} ${this.lastName()}`;
  }

  email(firstName, lastName) {
    const fn = (firstName || this.firstName()).toLowerCase().replace(/[^a-z]/g, '');
    const ln = (lastName || this.lastName()).toLowerCase().replace(/[^a-z]/g, '');
    const domain = this.customEmailDomain || this._randomItem(this.dataset.domains);
    
    const pattern = this._randomInt(1, 3);
    switch (pattern) {
      case 1:
        return `${fn}.${ln}${this._randomInt(10, 999)}@${domain}`;
      case 2:
        return `${fn}_${ln}@${domain}`;
      case 3:
      default:
        return `${fn}${this._randomInt(1, 99)}@${domain}`;
    }
  }

  website() {
    const fn = this.firstName().toLowerCase().replace(/[^a-z]/g, '');
    const tld = this.region === 'in' ? 'in' : 'com';
    return `https://www.${fn}ventures.${tld}`;
  }

  streetAddress() {
    const street = this._randomItem(this.dataset.streetNames);
    
    if (this.region === 'in') {
      const plots = ["Plot " + this._randomInt(1, 100), "Flat " + this._randomInt(101, 999), "House " + this._randomInt(1, 50)];
      return `${this._randomItem(plots)}, ${street}`;
    } else {
      const streetNum = this._randomInt(10, 9999);
      return `${streetNum} ${street}`;
    }
  }

  date(minStr = "", maxStr = "") {
    let minTimestamp = Date.now() - 65 * 365 * 24 * 60 * 60 * 1000;
    let maxTimestamp = Date.now() - 18 * 365 * 24 * 60 * 60 * 1000;
    
    if (minStr) {
      const parsedMin = Date.parse(minStr);
      if (!isNaN(parsedMin)) minTimestamp = parsedMin;
    }
    if (maxStr) {
      const parsedMax = Date.parse(maxStr);
      if (!isNaN(parsedMax)) maxTimestamp = parsedMax;
    }

    const randomTimestamp = this._randomInt(minTimestamp, maxTimestamp);
    const dateObj = new Date(randomTimestamp);
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  time() {
    const hour = String(this._randomInt(0, 23)).padStart(2, '0');
    const minute = String(this._randomInt(0, 59)).padStart(2, '0');
    return `${hour}:${minute}`;
  }

  datetimeLocal(minStr = "", maxStr = "") {
    const d = this.date(minStr, maxStr);
    const hour = String(this._randomInt(0, 23)).padStart(2, '0');
    const minute = String(this._randomInt(0, 59)).padStart(2, '0');
    return `${d}T${hour}:${minute}`;
  }

  number(min = null, max = null, isInteger = true, step = 1) {
    let lower = min !== null ? Number(min) : 1;
    let upper = max !== null ? Number(max) : 100;
    
    if (isNaN(lower)) lower = 1;
    if (isNaN(upper)) upper = 100;
    if (lower > upper) {
      const temp = lower;
      lower = upper;
      upper = temp;
    }

    if (isInteger) {
      return this._randomInt(lower, upper);
    } else {
      const rawVal = Math.random() * (upper - lower) + lower;
      const decimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 2;
      return Number(rawVal.toFixed(decimals));
    }
  }

  password(length = 16) {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=";
    
    const charSets = [uppercase, lowercase, numbers, symbols];
    let pwd = charSets.map(set => this._randomItem(set)).join('');
    
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = 0; i < (length - 4); i++) {
      pwd += this._randomItem(allChars);
    }
    
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  }

  paragraph() {
    return this._randomItem(this.textareaTemplates);
  }

  company() {
    return this._randomItem(this.dataset.companies);
  }

  addressDataset() {
    const loc = this._randomItem(this.dataset.locations);
    const city = this._randomItem(loc.cities);
    const zip = this._randomInt(loc.zipMin, loc.zipMax);
    const country = this.region === 'in' ? 'India' : 'United States';
    
    return {
      street: this.streetAddress(),
      city: city,
      state: loc.state,
      stateCode: loc.code,
      zip: String(zip),
      country: country,
      timezone: loc.timezone || (this.region === 'in' ? 'Asia/Kolkata' : 'America/New_York')
    };
  }

  phone() {
    let digits = "";
    if (this.region === 'in') {
      const startingDigit = this._randomItem(["6", "7", "8", "9"]);
      digits = startingDigit;
      for (let i = 0; i < 9; i++) {
        digits += String(this._randomInt(0, 9));
      }
    } else {
      const area = String(this._randomInt(200, 999));
      const exchange = String(this._randomInt(200, 999));
      const subscriber = String(this._randomInt(1000, 9999));
      digits = `${area}${exchange}${subscriber}`;
    }
    const prefix = this.customPhonePrefix || '';
    return `${prefix}${digits}`;
  }

  apiKey() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "ak_live_";
    for (let i = 0; i < 24; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  jsonHeaders() {
    return JSON.stringify({
      "Content-Type": "application/json",
      "Authorization": "Bearer " + this.password(),
      "X-Api-Key": this.apiKey()
    }, null, 2);
  }

  jsonStaticValues() {
    return JSON.stringify({
      "status": "active",
      "version": "1.0.2",
      "debug": false,
      "retry_attempts": this._randomInt(3, 5)
    }, null, 2);
  }
}

export { InstaFillDataGenerator };
