// seed.js

const mongoose = require('mongoose');

// نموذج الولاية
const State = mongoose.models.State || mongoose.model('State', new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  }
}, { timestamps: true }));

// نموذج الجامعة مع الموقع الجغرافي
const universitySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  state: {
    key: { type: String, required: true },
    name: {
      en: { type: String, required: true },
      ar: { type: String, required: true }
    }
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  }
}, { timestamps: true });

universitySchema.index({ location: '2dsphere' });

const University = mongoose.models.University || mongoose.model('University', universitySchema);

// بيانات الولايات
const statesData = [
  { key: "north_darfur", name: { en: "North Darfur", ar: "شمال دارفور" } },
  { key: "south_darfur", name: { en: "South Darfur", ar: "جنوب دارفور" } },
  { key: "khartoum", name: { en: "Khartoum", ar: "الخرطوم" } },
  { key: "gezira", name: { en: "Gezira", ar: "الجزيرة" } },
  { key: "kassala", name: { en: "Kassala", ar: "كسلا" } },
  { key: "port_sudan", name: { en: "Port Sudan", ar: "بورتسودان" } },
  { key: "nile_river", name: { en: "Nile River", ar: "نهر النيل" } },
  { key: "west_darfur", name: { en: "West Darfur", ar: "غرب دارفور" } },
  { key: "east_darfur", name: { en: "East Darfur", ar: "شرق دارفور" } },
  { key: "central_darfur", name: { en: "Central Darfur", ar: "دارفور الوسطى" } },
  { key: "north_kordofan", name: { en: "North Kordofan", ar: "شمال كردفان" } },
  { key: "south_kordofan", name: { en: "South Kordofan", ar: "جنوب كردفان" } },
  { key: "sennar", name: { en: "Sennar", ar: "سنار" } },
  { key: "white_nile", name: { en: "White Nile", ar: "النيل الأبيض" } },
  { key: "blue_nile", name: { en: "Blue Nile", ar: "النيل الأزرق" } },
  { key: "northern", name: { en: "Northern", ar: "الشمالية" } },
  { key: "west_kordofan", name: { en: "West Kordofan", ar: "غرب كردفان" } },
  { key: "al_qadarif", name: { en: "Al Qadarif", ar: "القضارف" } },
];

// بيانات الجامعات مع الإحداثيات
const universitiesData = [
  {
    key: "sust",
    name: {
      en: "Sudan University of Science and Technology",
      ar: "جامعة السودان للعلوم والتكنولوجيا"
    },
    stateKey: "khartoum",
    coordinates: [32.5678, 15.5432] // ← إحداثيات الجامعة
  },
  {
    key: "uofk",
    name: {
      en: "University of Khartoum",
      ar: "جامعة الخرطوم"
    },
    stateKey: "khartoum",
    coordinates: [32.5678, 15.5432]
  },
  {
    key: "neelain",
    name: {
      en: "Al-Neelain University",
      ar: "جامعة النيلين"
    },
    stateKey: "khartoum",
    coordinates: [32.5678, 15.5432]
  },
  {
    key: "quran_islamic",
    name: {
      en: "Quran University and Islamic Sciences",
      ar: "جامعة القرآن الكريم والعلوم الإسلامية"
    },
    stateKey: "khartoum",
    coordinates: [32.5678, 15.5432]
  },
  {
    key: "omdurman_islamic",
    name: {
      en: "Omdurman Islamic University",
      ar: "جامعة أم درمان الإسلامية"
    },
    stateKey: "khartoum",
    coordinates: [32.5678, 15.5432]
  },
  {
    key: "gezira",
    name: {
      en: "University of Gezira",
      ar: "جامعة الجزيرة"
    },
    stateKey: "gezira",
    coordinates: [33.2199, 13.0843]
  },
  {
    key: "elnilein",
    name: {
      en: "El Nilein University",
      ar: "جامعة النيلين"
    },
    stateKey: "gezira",
    coordinates: [33.2199, 13.0843]
  },
  {
    key: "kassala",
    name: {
      en: "Kassala University",
      ar: "جامعة كسلا"
    },
    stateKey: "kassala",
    coordinates: [36.4075, 15.4542]
  },
  {
    key: "red_sea",
    name: {
      en: "Red Sea University",
      ar: "جامعة البحر الأحمر"
    },
    stateKey: "port_sudan",
    coordinates: [37.2089, 19.6167]
  },
  {
    key: "alfashir",
    name: {
      en: "Al-Fashir University",
      ar: "جامعة الفاشر"
    },
    stateKey: "north_darfur",
    coordinates: [25.3556, 26.6778]
  },
  {
    key: "zalingei",
    name: {
      en: "Zalingei University",
      ar: "جامعة زالنجي"
    },
    stateKey: "north_darfur",
    coordinates: [23.4162, 25.1856]
  },
  {
    key: "nyala",
    name: {
      en: "Nyala University",
      ar: "جامعة نيالا"
    },
    stateKey: "south_darfur",
    coordinates: [24.9523, 24.9028]
  },
  {
    key: "junaynah",
    name: {
      en: "Al-Junaynah University",
      ar: "جامعة الجنينة"
    },
    stateKey: "west_darfur",
    coordinates: [23.0000, 25.9167]
  },
  {
    key: "aldhien",
    name: {
      en: "Al-Dhien University",
      ar: "جامعة الضعين"
    },
    stateKey: "east_darfur",
    coordinates: [22.2167, 26.1667]
  },
  {
    key: "ghabish",
    name: {
      en: "Ghabish University",
      ar: "جامعة غبيش"
    },
    stateKey: "central_darfur",
    coordinates: [25.3333, 24.8833]
  },
  {
    key: "kordofan",
    name: {
      en: "University of Kordofan",
      ar: "جامعة كردفان"
    },
    stateKey: "north_kordofan",
    coordinates: [29.9167, 29.8500]
  },
  {
    key: "south_kordofan",
    name: {
      en: "South Kordofan University",
      ar: "جامعة جنوب كردفان"
    },
    stateKey: "south_kordofan",
    coordinates: [28.0000, 30.0000]
  },
  {
    key: "sennar",
    name: {
      en: "Sennar University",
      ar: "جامعة سنار"
    },
    stateKey: "sennar",
    coordinates: [33.6000, 13.2000]
  },
  {
    key: "white_nile",
    name: {
      en: "White Nile University",
      ar: "جامعة النيل الأبيض"
    },
    stateKey: "white_nile",
    coordinates: [32.5678, 16.0000]
  },
  {
    key: "blue_nile",
    name: {
      en: "Blue Nile University",
      ar: "جامعة النيل الأزرق"
    },
    stateKey: "blue_nile",
    coordinates: [34.5678, 13.0000]
  },
  {
    key: "shendi",
    name: {
      en: "Shendi University",
      ar: "جامعة شندي"
    },
    stateKey: "nile_river",
    coordinates: [33.3928, 15.6500]
  },
  {
    key: "dongola",
    name: {
      en: "Dongola University",
      ar: "جامعة دنقلا"
    },
    stateKey: "northern",
    coordinates: [30.5333, 21.2333]
  },
  {
    key: "abyad",
    name: {
      en: "Al-Abyad University",
      ar: "جامعة الأبيض"
    },
    stateKey: "west_kordofan",
    coordinates: [27.0667, 14.8667]
  },
  {
    key: "qadarif",
    name: {
      en: "Al Qadarif University",
      ar: "جامعة القضارف"
    },
    stateKey: "al_qadarif",
    coordinates: [35.3833, 14.0667]
  },
];

async function seedDatabase() {
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect('mongodb+srv://ahmed:jFRDH2EgcI8AD9m4@cluster0.gcasm.mongodb.net/userDB?retryWrites=true&w=majority');
      console.log('✅ Connected to MongoDB for seeding');
    }

    console.log('🌱 Starting database seeding...');

    await State.deleteMany({});
    await University.deleteMany({});

    const insertedStates = await State.insertMany(statesData);
    console.log(`✅ Inserted ${insertedStates.length} states`);

    const universityDocs = universitiesData.map(u => {
      const state = statesData.find(s => s.key === u.stateKey);
      return {
        key: u.key,
        name: u.name,
        state: {
          key: u.stateKey,
          name: state ? state.name : { en: 'Unknown', ar: 'غير معروف' }
        },
        location: {
          type: 'Point',
          coordinates: u.coordinates
        }
      };
    });

    const insertedUniversities = await University.insertMany(universityDocs);
    console.log(`✅ Inserted ${insertedUniversities.length} universities`);
    console.log('🎉 Database seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

module.exports = seedDatabase;