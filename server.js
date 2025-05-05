const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { Decimal128 } = require('mongodb');
const nodemailer = require('nodemailer');
const braintree = require('braintree');
const bodyParser = require('body-parser'); // استيراد body-parser
const pdfCreator = require('pdf-creator-node');
const app = express();
const axios = require('axios');
const stripe = require('stripe')('sk_test_51QfmCJKwGdbDTqjONl2F5gSRpVuTE4NEsfeuHYMnex8SRAu0uIex8PqpCBoXkJDyTMx9WfMsPoMX0T3QzdTmv6aQ00fLzBugFe');
const port = 3001;

// إعداد CORS للسماح بالتواصل مع تطبيق Flutter
app.use(cors());// إعداد Body parser لقراءة البيانات من الطلبات
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
// الاتصال بقاعدة بيانات MongoDB
mongoose.connect('mongodb+srv://ahmed:jFRDH2EgcI8AD9m4@cluster0.gcasm.mongodb.net/userDB?retryWrites=true&w=majority')
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log('Error connecting to MongoDB: ', error));

// إعداد Cloudinary
cloudinary.config({
  cloud_name: 'dpdgpxrl2',
  api_key: '989476428679847',
  api_secret: '0zFd46XHJXcGq_vZoFmutPmbrJ0'
});

// إعداد تخزين الصور باستخدام multer (للتعامل مع الصورة محليًا)
const storage = multer.memoryStorage(); // لتخزين الصورة في الذاكرة مباشرة
const upload = multer({ storage: multer.memoryStorage() }); // تحديد التخزين في الذاكرة

// نموذج المستخدم
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  profileImage: String, 
  accountType: { type: String, enum: ['Student', 'University', 'Administrator'] }, // أضفنا Administrator هنا
  studentId: { type: String, required: function() { return this.accountType === 'Student'; } },
  major: { type: String, required: function() { return this.accountType === 'Student'; } },
  universityName: { type: String, required: function() { return this.accountType === 'University'; } },  
  universityCode: { type: String, required: function() { return this.accountType === 'University'; } },  
  universityAddress: { type: String, required: function() { return this.accountType === 'University'; } },
  studentCount: { type: String, required: function() { return this.accountType === 'University'; } },   
});

// نموذج OTP
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, default: Date.now, expires: 300 }, // ينتهي بعد 5 دقائق
});

const User = mongoose.model('User', userSchema);
const OTP = mongoose.model('OTP', otpSchema);

const PropertySchema = new mongoose.Schema({
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  profileImage: { type: String, required: true },
  ownerId: { type: String, required: true },
  hostelName: { type: String, required: true },
  gender: { type: String, enum: ['Males', 'Females'], required: true },
  singleRooms: { type: Number, required: true }, // عدد الغرف الفردية
  sharedRooms: { type: Number, required: true }, // عدد الغرف المشتركة
  bedsPerSharedRoom: { type: Number, required: true }, // عدد الأسرة في الغرفة المشتركة
  internetAvailable: { type: Boolean, default: false }, // توفر الإنترنت
  bathroomType: { type: String, enum: ['Private', 'Shared'], required: true }, // نوع الحمام
  cleaningService: { type: Boolean, default: false }, // خدمة التنظيف
  maintenanceService: { type: Boolean, default: false }, // خدمة الصيانة
  securitySystem: { type: Boolean, default: false }, // نظام الأمان
  emergencyMeasures: { type: Boolean, default: false }, // إجراءات الطوارئ
  goodLighting: { type: Boolean, default: false }, // إضاءة جيدة
  sharedAreas: { type: Boolean, default: false }, // مناطق مشتركة
  studyRooms: { type: Boolean, default: false }, // غرف دراسة
  laundryRoom: { type: Boolean, default: false }, // غرفة غسيل
  sharedKitchen: { type: Boolean, default: false }, // مطبخ مشترك
  foodService: { type: Boolean, default: false }, // خدمة الطعام
  effectiveManagement: { type: Boolean, default: false }, // إدارة فعالة
  psychologicalSupport: { type: Boolean, default: false }, // دعم نفسي
  location: {
    lat: { type: Number, required: true }, // خط العرض
    lng: { type: Number, required: true }, // خط الطول
  },
  imageUrls: [{ type: String }], // روابط الصور
  singleRoomPrice: { type: Number, required: true }, // سعر الغرفة الفردية
  sharedRoomPrice: { type: Number, required: true }, // سعر الغرفة المشتركة
  pricePeriod: { type: String, enum: ['day', 'month', 'term'], required: true }, // فترة السعر
  state: { type: String, required: true }, // الولاية
  index: { type: Number, default: 0 }, // الفهرس
  averageRating: {type: Number,default: 0},
  ratingCount: {type: Number,default: 0
  }
}, { timestamps: true });




const Property = mongoose.model('Property', PropertySchema);
// إعداد nodemailer لإرسال البريد عبر Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'alaeldindev@gmail.com', // استبدل ببريدك الإلكتروني
    pass: 'ymya nmbo glwq aghv', // استبدل بكلمة مرور التطبيقات
  },
});

// وظيفة إرسال OTP عبر Gmail
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: 'alaeldindev@gmail.com', // البريد الإلكتروني الخاص بك
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
    html: `<strong>Your OTP code is: ${otp}</strong>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully');
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// **إنشاء حساب جديد**
app.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, email, password, accountType, studentId, major, universityName, universityCode, universityAddress, studentCount } = req.body;

    // تحقق من صحة البيانات
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'accountType'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all the necessary details.',
        missingFields: missingFields,
      });
    }

    // تحقق من وجود المستخدم
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists. Please use a different email.',
      });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    let profileImageUrl = '';
    if (req.file) {
      // رفع الصورة إلى Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);
      profileImageUrl = result.secure_url; // الحصول على رابط الصورة من Cloudinary
    }

    // إنشاء مستخدم جديد بناءً على نوع الحساب
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      profileImage: profileImageUrl, 
      accountType, 
      studentId: accountType === 'Student' ? studentId : undefined,
      major: accountType === 'Student' ? major : undefined,
      universityName: accountType === 'University' ? universityName : undefined,
      universityCode: accountType === 'University' ? universityCode : undefined,
      universityAddress: accountType === 'University' ? universityAddress : undefined,
      studentCount: accountType === 'University' ? studentCount : undefined,
    });

    await newUser.save();

    // إنشاء وإرسال OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await sendOTPEmail(email, otp);

    // حفظ OTP في قاعدة البيانات
    const newOTP = new OTP({ email, otp });
    await newOTP.save();

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully. OTP sent to your email.',
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        profileImage: newUser.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating the account.',
      error: error.message,
    });
  }
});

// **تسجيل الدخول**
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found. Please check your email or sign up.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid password. Please try again.',
      });
    }

    const token = jwt.sign({ id: user._id }, 'your_jwt_secret_key', { expiresIn: '1h' });

    // بناء الاستجابة بناءً على نوع الحساب
    let userData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImage: user.profileImage,
    };

    // إذا كان نوع الحساب "Student"
    if (user.accountType === 'Student') {
      userData = {
        ...userData,
        accountType: user.accountType,
        studentId: user.studentId,
        major: user.major,
      };
    }
    // إذا كان نوع الحساب "University"
    else if (user.accountType === 'University') {
      userData = {
        ...userData,
        accountType: user.accountType,
        universityName: user.universityName,
        universityCode: user.universityCode,
        universityAddress: user.universityAddress,
        studentCount: user.studentCount,
      };
    }

    res.status(200).json({
      status: 'success',
      message: 'Login successful!',
      token: token,
      user: userData,  // إرجاع البيانات المناسبة بناءً على نوع الحساب
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while logging in.',
      error: error.message,
    });
  }
});

// **تحديث الملف الشخصي**
app.post('/update-profile', upload.single('profileImage'), async (req, res) => {
  try {
    console.log('Received request to update profile:', req.body); // تتبع البيانات القادمة من العميل
    console.log('File:', req.file); // إذا كانت هناك صورة مرفوعة

    // استخراج البيانات من الـ request body
    const {
      id,
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      dob,
      accountType,
      studentId,
      major,
      universityName,
      universityCode,
      universityAddress,
      studentCount
    } = req.body;

    // التحقق من وجود ID المستخدم
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required to update profile.'
      });
    }

    // تجهيز البيانات التي سيتم تحديثها
    let updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (gender) updateData.gender = gender;
    if (dob) updateData.dob = dob;
    if (accountType) updateData.accountType = accountType;

    // التحقق من نوع الحساب (Student أو University) وتحديث الحقول المناسبة
    if (accountType === 'Student') {
      if (studentId) updateData.studentId = studentId;
      if (major) updateData.major = major;
    } else if (accountType === 'University') {
      if (universityName) updateData.universityName = universityName;
      if (universityCode) updateData.universityCode = universityCode;
      if (universityAddress) updateData.universityAddress = universityAddress;
      if (studentCount) updateData.studentCount = studentCount;
    }

    // إذا تم رفع صورة جديدة، رفعها إلى Cloudinary
    if (req.file) {
      const buffer = req.file.buffer; // استخراج الـ buffer من الملف

      // رفع الصورة إلى Cloudinary باستخدام Buffer
      const result = await cloudinary.uploader.upload_stream(
        { resource_type: "auto" }, // تحديد نوع المورد (image, video, etc.)
        async (error, result) => {
          if (error) {
            console.error("Error uploading to Cloudinary:", error);
            return res.status(500).json({
              status: 'error',
              message: 'Error uploading image to Cloudinary.',
              error: error.message,
            });
          }

          // إضافة الرابط الآمن للصورة
          updateData.profileImage = result.secure_url;

          // تحديث بيانات المستخدم في قاعدة البيانات
          const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });

          if (!updatedUser) {
            return res.status(404).json({
              status: 'error',
              message: 'User not found.'
            });
          }

          res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully!',
            user: updatedUser // إرجاع البيانات المحدثة للمستخدم
          });
        }
      );

      // رفع الصورة مباشرة عبر الـ buffer باستخدام pipe
      buffer && result.end(buffer); // استخدم .end بدلاً من .pipe لأنها طريقة لتمرير الـ buffer مباشرة إلى Cloudinary
    } else {
      // في حالة عدم رفع صورة جديدة، نكمل التحديث دون تعديل الصورة
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });

      if (!updatedUser) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully!',
        user: updatedUser
      });
    }

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating the profile.',
      error: error.message
    });
  }
});

app.post('/addProperty', async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    profileImage,
    ownerId,
    hostelName,
    singleRooms,
    sharedRooms,
    bedsPerSharedRoom,
    internetAvailable,
    bathroomType,
    cleaningService,
    maintenanceService,
    securitySystem,
    emergencyMeasures,
    goodLighting,
    sharedAreas,
    studyRooms,
    laundryRoom,
    sharedKitchen,
    foodService,
    effectiveManagement,
    psychologicalSupport,
    location,
    imageUrls,
    singleRoomPrice,
    sharedRoomPrice,
    pricePeriod,
    state,
    gender,
  } = req.body;

  try {
    // التحقق من البيانات
    if (!hostelName || !singleRooms || !sharedRooms || !bedsPerSharedRoom || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // إضافة العقار إلى قاعدة البيانات
    const newProperty = new Property({
      email,
      firstName,
      lastName,
      profileImage,
      ownerId,
      hostelName,
      singleRooms,
      sharedRooms,
      bedsPerSharedRoom,
      internetAvailable,
      bathroomType,
      cleaningService,
      maintenanceService,
      securitySystem,
      emergencyMeasures,
      goodLighting,
      sharedAreas,
      studyRooms,
      laundryRoom,
      sharedKitchen,
      foodService,
      effectiveManagement,
      psychologicalSupport,
      location,
      imageUrls,
      singleRoomPrice,
      sharedRoomPrice,
      pricePeriod,
      state,
      gender,
    });

    await newProperty.save();

    res.status(201).json({ message: "Property added successfully" });
  } catch (error) {
    console.error("Error adding property:", error);
    res.status(500).json({ error: "Failed to add property" });
  }
});

app.get('/getAllProperties', async (req, res) => {
  try {
    const properties = await Property.find({});
    const formattedProperties = properties.map((property, index) => ({
      _id: property._id,
      hostelName: property.hostelName || 'N/A',
      pricePeriod: property.pricePeriod || 'N/A',
      singleRooms: property.singleRooms ? parseFloat(property.singleRooms) : 0,
      sharedRooms: property.sharedRooms ? parseFloat(property.sharedRooms) : 0,
      bedsPerSharedRoom: property.bedsPerSharedRoom ? parseFloat(property.bedsPerSharedRoom) : 0,
      singleRoomPrice: property.singleRoomPrice ? parseFloat(property.singleRoomPrice) : 0,
      sharedRoomPrice: property.sharedRoomPrice ? parseFloat(property.sharedRoomPrice) : 0,
      index: index + 1,
      imageUrls: property.imageUrls || [],
      location: {
        lat: property.location && property.location.lat ? parseFloat(property.location.lat) : 0.0,
        lng: property.location && property.location.lng ? parseFloat(property.location.lng) : 0.0,
      },
      ownerId: property.ownerId || '',
      profileImage: property.profileImage || '',
      bathroomType: property.bathroomType || 'N/A',
      internetAvailable: property.internetAvailable || false,
      cleaningService: property.cleaningService || false,
      maintenanceService: property.maintenanceService || false,
      securitySystem: property.securitySystem || false,
      emergencyMeasures: property.emergencyMeasures || false,
      goodLighting: property.goodLighting || false,
      sharedAreas: property.sharedAreas || false,
      studyRooms: property.studyRooms || false,
      laundryRoom: property.laundryRoom || false,
      sharedKitchen: property.sharedKitchen || false,
      foodService: property.foodService || false,
      effectiveManagement: property.effectiveManagement || false,
      psychologicalSupport: property.psychologicalSupport || false,
      state: property.state || 'N/A',
      gender: property.gender || 'N/A',
    }));
    res.status(200).json({ properties: formattedProperties });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});


// نقطة النهاية لجلب بيانات مالك العقار
app.get('/getOwnerDetails/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;

    // البحث عن المستخدم باستخدام ownerId
    const owner = await User.findById(ownerId);

    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }

    // إرجاع بيانات المالك
    res.status(200).json({
      firstName: owner.firstName,
      lastName: owner.lastName,
      profileImage: owner.profileImage,
    });
  } catch (error) {
    console.error('Error fetching owner details:', error);
    res.status(500).json({ message: 'Failed to fetch owner details', error: error.message });
  }
});

// **إرسال OTP**
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    // إنشاء رمز OTP عشوائي
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // إرسال OTP عبر البريد الإلكتروني
    await sendOTPEmail(email, otp);

    // حفظ OTP في قاعدة البيانات
    const newOTP = new OTP({ email, otp });
    await newOTP.save();

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

// **التحقق من OTP**
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    // البحث عن OTP في قاعدة البيانات
    const savedOTP = await OTP.findOne({ email, otp });
    if (!savedOTP) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // إذا كان OTP صحيحًا، حذفه من قاعدة البيانات
    await OTP.deleteOne({ email, otp });

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
});

// دالة لحساب المسافة بين نقطتين باستخدام صيغة Haversine
function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371; // نصف قطر الأرض بالكيلومترات

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c; // المسافة بالكيلومترات
}

// دالة لتحويل الدرجات إلى راديان
function toRadians(degree) {
  return degree * (Math.PI / 180);
}

// إضافة نقطة نهاية جديدة في Express
app.post('/getLocationRecommendations', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    // جلب جميع العقارات من قاعدة البيانات
    const allProperties = await Property.find({});

    // تحويل البيانات إلى التنسيق المطلوب
    const propertiesWithDistances = allProperties.map((property) => {
      const propertyLatitude = property.location.lat;
      const propertyLongitude = property.location.lng;

      // حساب المسافة بين العقار الحالي والموقع المحدد
      const distance = calculateDistance(latitude, longitude, propertyLatitude, propertyLongitude);

      return {
        ...property.toObject(),
        distance,
      };
    });

    // تصفية العقارات التي تبعد أقل من أو تساوي 10 كيلومترات
    const recommendedProperties = propertiesWithDistances.filter(
      (property) => property.distance <= 10
    );

    // إرسال الاستجابة
    res.status(200).json({ properties: recommendedProperties });
  } catch (error) {
    console.error('Error fetching location recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch location recommendations' });
  }
});


// نموذج الحجز
const bookingSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  hostelName: { 
    type: String,
    required: true
  },
  gender: { 
    type: String,
    required: true
  },
  state: { 
    type: String,
    required: true
  },
  ownerId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    default: null,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  roomType: {
    type: String,
    enum: ['Single', 'Shared'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  pricePeriod: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
    default: () => 'TRX-' + Date.now().toString(),
  },
  receiptUrl: {
    type: String,
    default: function () {
      return '/receipt/' + this._id;
    },
  },
  qrCodeUrl: {
    type: String,
    default: function () {
      return '/qrcode/' + this._id;
    },
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
});

const Booking = mongoose.model('Booking', bookingSchema);

//⚙️ دالة لتوليد الإيصال بصيغة PDF
function generateReceipt(data) {
  const html = `
    <h1>E-Receipt</h1>
    <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
    <p><strong>Property Name:</strong> ${data.propertyName}</p>
    <p><strong>User:</strong> ${data.fullName}</p>
    <p><strong>Room Type:</strong> ${data.roomType}</p>
    <p><strong>Price:</strong> ${data.price} SDG</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  `;

  const options = {
    format: 'A4',
  };

  const document = {
    html: html,
    data: {},
    path: false, // لن نحفظ الملف
  };

  return pdfCreator.create(document, options);
}

//⚙️ دالة لتوليد QR Code

const QRCode = require('qrcode');


app.get('/receipt/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    // جلب بيانات الحجز من قاعدة البيانات
    const Booking = mongoose.model('Booking');
    const booking = await Booking.findById(bookingId).populate('propertyId');

    if (!booking || !booking.propertyId) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const property = booking.propertyId;

    // توليد الإيصال مباشرة بدون حفظ
    const pdfData = await generateReceipt({
      propertyName: property.hostelName,
      fullName: `${booking.firstName} ${booking.lastName}`,
      roomType: booking.roomType,
      price: booking.roomType === 'Single' ? property.singleRoomPrice : property.sharedRoomPrice,
      transactionId: booking.transactionId,
    });

    // ضبط الرؤوس لإرسال PDF كملف قابل للتنزيل
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename=receipt_${booking.transactionId}.pdf`);
    res.send(pdfData.pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ success: false, message: 'Failed to generate receipt' });
  }
});


app.get('/qrcode/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    // جلب بيانات الحجز من قاعدة البيانات
    const Booking = mongoose.model('Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // توليد QR Code كـ Base64
    const qrCode = await generateQrCode({
      transactionId: booking.transactionId,
    });

    // استخراج Base64 من Data URL
    const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');

    // إرسال الصورة كـ PNG
    res.contentType('image/png');
    res.send(Buffer.from(base64Data, 'base64'));
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

async function generateQrCode(data) {
  return await QRCode.toDataURL(data.transactionId); // تحويل ID إلى Base64 QR
}

// نقطة نهاية لتسجيل الحجز
app.post('/bookings', async (req, res) => {
  const {
    propertyId,
    ownerId,
    userId,
    firstName,
    lastName,
    email,
    phone,
    roomType,
    price,
    pricePeriod,
  } = req.body;

  try {
    const Property = mongoose.model('Property');
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (roomType === 'Single' && property.singleRooms <= 0) {
      return res.status(400).json({ success: false, message: 'No single rooms available' });
    }
    if (roomType === 'Shared' && property.sharedRooms <= 0) {
      return res.status(400).json({ success: false, message: 'No shared rooms available' });
    }

    if (roomType === 'Single') property.singleRooms -= 1;
    else if (roomType === 'Shared') property.sharedRooms -= 1;
    await property.save();

    const Booking = mongoose.model('Booking');

    const newBooking = new Booking({
      propertyId,
      ownerId,
      userId,
      firstName,
      lastName,
      email,
      phone,
      roomType,
      price,
      pricePeriod,
      hostelName: property.hostelName,
      state: property.state,
      gender: property.gender
    });

    await newBooking.save();

    res.status(200).json({
      success: true,
      message: 'Booking successful',
      booking: {
        ...newBooking._doc,
        hostelName: property?.hostelName || 'Unknown Property',
        state: property?.state || 'Unknown state',
        gender: property?.gender || 'Unknown gender',
        receiptUrl: `/receipt/${newBooking._id}`,
        qrCodeUrl: `/qrcode/${newBooking._id}`,
      },
    });
  } catch (error) {
    console.error('Error booking property:', error);
    res.status(500).json({ success: false, message: 'Failed to book property' });
  }
});


// GET /bookings/user/:userId - لجلبة كل حجوزات المستخدم
app.get('/bookings/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب الحجوزات مع معلومات العقار
    const bookings = await Booking.find({ userId })
      .populate('propertyId', 'hostelName imageUrls singleRoomPrice sharedRoomPrice state gender')
      .sort({ bookingDate: -1 });

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bookings found for this user',
        bookings: []
      });
    }

    // تنسيق البيانات للإرسال
    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      propertyId: booking.propertyId?._id || null,
      hostelName: booking.propertyId?.hostelName || booking.hostelName,
      state: booking.propertyId?.state || booking.state,
      gender: booking.propertyId?.gender || booking.gender,
      roomType: booking.roomType,
      price: booking.price,
      pricePeriod: booking.pricePeriod,
      transactionId: booking.transactionId,
      receiptUrl: booking.receiptUrl,
      qrCodeUrl: booking.qrCodeUrl,
      bookingDate: booking.bookingDate,
      propertyImage: booking.propertyId?.imageUrls?.[0] || null,
      singleRoomPrice: booking.propertyId?.singleRoomPrice || 0,
      sharedRoomPrice: booking.propertyId?.sharedRoomPrice || 0
    }));

    res.status(200).json({
      success: true,
      bookings: formattedBookings
    });

  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user bookings'
    });
  }
});


// GET /bookings/:bookingId - لجلبة تفاصيل حجز معين
app.get('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    // جلب الحجز مع معلومات العقار والمستخدم
    const booking = await Booking.findById(bookingId)
      .populate('propertyId', 'hostelName imageUrls singleRoomPrice sharedRoomPrice state gender')
      .populate('userId', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // تنسيق البيانات للإرسال
    const formattedBooking = {
      _id: booking._id,
      property: {
        _id: booking.propertyId?._id || null,
        hostelName: booking.propertyId?.hostelName || booking.hostelName,
        state: booking.propertyId?.state || booking.state,
        gender: booking.propertyId?.gender || booking.gender,
        imageUrls: booking.propertyId?.imageUrls || [],
        singleRoomPrice: booking.propertyId?.singleRoomPrice || 0,
        sharedRoomPrice: booking.propertyId?.sharedRoomPrice || 0
      },
      user: {
        _id: booking.userId?._id || null,
        firstName: booking.userId?.firstName || booking.firstName,
        lastName: booking.userId?.lastName || booking.lastName,
        email: booking.userId?.email || booking.email,
        phone: booking.userId?.phone || booking.phone
      },
      roomType: booking.roomType,
      price: booking.price,
      pricePeriod: booking.pricePeriod,
      transactionId: booking.transactionId,
      receiptUrl: booking.receiptUrl,
      qrCodeUrl: booking.qrCodeUrl,
      bookingDate: booking.bookingDate
    };

    res.status(200).json({
      success: true,
      booking: formattedBooking
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking details'
    });
  }
});


app.get('/bookings/property/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // جلب الحجوزات بناءً على propertyId
    const bookings = await Booking.find({ propertyId }).populate('userId', 'firstName lastName email');

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        bookings: [],
        message: 'لا توجد حجوزات لهذا العقار'
      });
    }

    res.status(200).json({
      success: true,
      bookings: bookings
    });

  } catch (error) {
    console.error('خطأ في جلب الحجوزات:', error);
    res.status(500).json({
      success: false,
      error: 'فشل في جلب الحجوزات'
    });
  }
});


// GET /bookings?userId=<userId>
app.get('/bookings', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId in query parameters',
      });
    }

    const bookings = await Booking.find({ userId }).populate('propertyId', 'hostelName');

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        bookings: [],
        message: 'لا توجد حجوزات لهذا المستخدم',
      });
    }

    // تنسيق البيانات كما يريدها التطبيق
   const formattedBookings = bookings.map(booking => ({
  _id: booking._id,
  propertyId: booking.propertyId ?? 'N/A',
  ownerId: booking.ownerId ?? 'N/A',
  userId: booking.userId ?? 'N/A',
  firstName: booking.firstName ?? 'N/A',
  lastName: booking.lastName ?? 'N/A',
  email: booking.email ?? 'N/A',
  phone: booking.phone ?? 'N/A',
  roomType: booking.roomType ?? 'N/A',
  price: booking.price ?? 0,
  pricePeriod: booking.pricePeriod ?? 'N/A',
  hostelName: booking.hostelName ?? 'N/A',
  state: booking.state ?? 'N/A',
  gender: booking.gender ?? 'N/A',
  transactionId: booking.transactionId ?? 'N/A',
  receiptUrl: booking.receiptUrl ?? 'N/A',
  qrCodeUrl: booking.qrCodeUrl ?? 'N/A',
  bookingDate: booking.bookingDate ?? new Date(),
}));

    res.status(200).json({
      success: true,
      bookings: formattedBookings,
    });

  } catch (error) {
    console.error('خطأ في جلب الحجوزات:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load bookings',
    });
  }
});

// دالة للتحقق من صحة رقم الهاتف (يمكن استبدالها بمكتبة مثل libphonenumber-js)
function isValidPhoneNumber(phone) {
  // يمكن إضافة منطق للتحقق من صحة الرقم بناءً على رمز الدولة
  return phone && phone.length >= 7 && phone.length <= 15; // مثال بسيط
}


app.get('/getProperty/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    res.status(200).json({
      success: true,
      property: {
        _id: property._id,
        hostelName: property.hostelName,
        location: property.location,
        singleRoomPrice: property.singleRoomPrice,
        sharedRoomPrice: property.sharedRoomPrice,
        imageUrls: property.imageUrls,
      },
    });

  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property details' });
  }
});


//1. جلب العقارات الخاصة بالمستخدم:

app.get('/getPropertiesByOwner/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    // جلب العقارات الخاصة بالمستخدم
    const properties = await Property.find({ ownerId });
    

    res.status(200).json({ properties });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

//2. حذف العقار:


app.delete('/deleteProperty/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // حذف العقار
    await Property.findByIdAndDelete(propertyId);

    res.status(200).json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});


app.put('/updateProperty/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const updatedData = req.body;

    // تحديث العقار
    const updatedProperty = await Property.findByIdAndUpdate(propertyId, updatedData, { new: true });

    res.status(200).json({ message: 'Property updated successfully', property: updatedProperty });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

app.get('/client-token', async (req, res) => {
  try {
    const clientToken = await gateway.clientToken.generate({});
    res.status(200).json({ clientToken: clientToken.clientToken });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}); 
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox, // أو Production
  merchantId: 'wq436ncg39rjd575',
  publicKey: 'ftjy44vpjpwbmy3f',
  privateKey: 'c3347ef3d1ae2c401fd8595f19a369cf',
});

app.post('/braintree-webhook', (req, res) => {
  const webhookNotification = gateway.webhookNotification.parse(
    req.body.bt_signature,
    req.body.bt_payload
  );

  switch (webhookNotification.kind) {
    case 'transaction_settled':
      console.log('Payment settled:', webhookNotification.transaction.id);
      // قم بتنفيذ الإجراءات المطلوبة هنا
      break;

    case 'transaction_failed':
      console.log('Payment failed:', webhookNotification.transaction.id);
      // قم بتنفيذ الإجراءات المطلوبة هنا
      break;

    default:
      console.log('Unhandled webhook event:', webhookNotification.kind);
  }

  res.status(200).send('Webhook received');
});

app.post('/process-payment', async (req, res) => {
  const { paymentNonce, amount } = req.body;

  try {
    const result = await gateway.transaction.sale({
      amount: amount,
      paymentMethodNonce: paymentNonce,
      options: {
        submitForSettlement: true,
      },
    });

    if (result.success) {
      res.status(200).json({ message: 'Payment successful', transactionId: result.transaction.id });
    } else {
      res.status(400).json({ message: 'Payment failed', error: result.message });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



app.post('/checkExistingBooking', async (req, res) => {
  const { userId, propertyId } = req.body;

  try {
    // البحث عن حجز سابق
    const existingBooking = await Booking.findOne({ userId, propertyId });

    if (existingBooking) {
      res.status(200).json({ exists: true });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(bodyParser.json());
// نقطة نهاية لإنشاء PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;

  // تسجيل البيانات الواردة
  console.log('Received request to create PaymentIntent with amount:', amount);

  try {
    // إنشاء PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // المبلغ بالـ سنتات
      currency: 'usd',
    });

    // تسجيل تفاصيل PaymentIntent
    console.log('PaymentIntent created successfully:', paymentIntent.id);

    // إرسال الرد إلى العميل
    res.send({
      client_secret: paymentIntent.client_secret,
    });
  } catch (error) {
    // تسجيل الخطأ
    console.error('Error creating PaymentIntent:', error.message);

    // إرسال رسالة الخطأ إلى العميل
    res.status(500).send({ error: error.message });
  }
});

const ratingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// نقاط النهاية للتقييمات
app.post('/submitRating', async (req, res) => {
  try {
    const { userId, propertyId, rating, comment } = req.body;

    // التحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found. Please sign in to submit rating.' 
      });
    }

    // التحقق من وجود العقار
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    // التحقق من صحة التقييم
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Rating must be between 1 and 5' 
      });
    }

    // التحقق من عدم وجود تقييم سابق
    const existingRating = await Rating.findOne({ user: userId, property: propertyId });
    if (existingRating) {
      return res.status(400).json({ 
        success: false,
        error: 'You have already rated this property' 
      });
    }

    // إنشاء تقييم جديد
    const newRating = new Rating({
      user: userId,
      property: propertyId,
      rating: rating,
      comment: comment || null
    });

    await newRating.save();

    // حساب متوسط التقييمات الجديد
    const ratings = await Rating.find({ property: propertyId });
    const totalRatings = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatings / ratings.length;

    // تحديث العقار بمتوسط التقييمات الجديد
    await Property.findByIdAndUpdate(propertyId, { 
      averageRating: averageRating,
      ratingCount: ratings.length 
    });

    res.status(200).json({ 
      success: true,
      message: 'Rating submitted successfully',
      averageRating: averageRating,
      ratingCount: ratings.length
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.get('/getPropertyRatings/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // التحقق من وجود العقار
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    // جلب التقييمات مع معلومات المستخدمين
    const ratings = await Rating.find({ property: propertyId })
      .populate('user', 'firstName lastName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true,
      ratings: ratings,
      averageRating: property.averageRating,
      ratingCount: property.ratingCount
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.get('/getUserRating/:userId/:propertyId', async (req, res) => {
  try {
    const { userId, propertyId } = req.params;

    const rating = await Rating.findOne({ 
      user: userId, 
      property: propertyId 
    });

    if (!rating) {
      return res.status(200).json({ 
        success: true,
        hasRated: false 
      });
    }

    res.status(200).json({ 
      success: true,
      hasRated: true,
      rating: rating.rating,
      comment: rating.comment,
      createdAt: rating.createdAt
    });

  } catch (error) {
    console.error('Error fetching user rating:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});// نقاط النهاية للتقييمات
app.post('/submitRating', async (req, res) => {
  try {
    const { userId, propertyId, rating, comment } = req.body;

    // التحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found. Please sign in to submit rating.' 
      });
    }

    // التحقق من وجود العقار
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    // التحقق من صحة التقييم
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Rating must be between 1 and 5' 
      });
    }

    // التحقق من عدم وجود تقييم سابق
    const existingRating = await Rating.findOne({ user: userId, property: propertyId });
    if (existingRating) {
      return res.status(400).json({ 
        success: false,
        error: 'You have already rated this property' 
      });
    }

    // إنشاء تقييم جديد
    const newRating = new Rating({
      user: userId,
      property: propertyId,
      rating: rating,
      comment: comment || null
    });

    await newRating.save();

    // حساب متوسط التقييمات الجديد
    const ratings = await Rating.find({ property: propertyId });
    const totalRatings = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatings / ratings.length;

    // تحديث العقار بمتوسط التقييمات الجديد
    await Property.findByIdAndUpdate(propertyId, { 
      averageRating: averageRating,
      ratingCount: ratings.length 
    });

    res.status(200).json({ 
      success: true,
      message: 'Rating submitted successfully',
      averageRating: averageRating,
      ratingCount: ratings.length
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});
const Rating = mongoose.model('Rating', ratingSchema);

app.get('/getPropertyRatings/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // التحقق من وجود العقار
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    // جلب التقييمات مع معلومات المستخدمين
    const ratings = await Rating.find({ property: propertyId })
      .populate('user', 'firstName lastName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true,
      ratings: ratings,
      averageRating: property.averageRating,
      ratingCount: property.ratingCount
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.get('/getUserRating/:userId/:propertyId', async (req, res) => {
  try {
    const { userId, propertyId } = req.params;

    const rating = await Rating.findOne({ 
      user: userId, 
      property: propertyId 
    });

    if (!rating) {
      return res.status(200).json({ 
        success: true,
        hasRated: false 
      });
    }

    res.status(200).json({ 
      success: true,
      hasRated: true,
      rating: rating.rating,
      comment: rating.comment,
      createdAt: rating.createdAt
    });

  } catch (error) {
    console.error('Error fetching user rating:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});


app.get('/getPropertyRatings/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // التحقق من وجود العقار
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    // جلب جميع التقييمات للعقار مع معلومات المستخدمين
    const ratings = await Rating.find({ property: propertyId })
      .populate('user', 'firstName lastName profileImage');

    res.status(200).json({ 
      success: true,
      ratings: ratings,
      averageRating: property.averageRating,
      ratingCount: property.ratingCount
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});


// دالة لحساب المسافة بين نقطتين باستخدام صيغة Haversine
function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371; // نصف قطر الأرض بالكيلومترات

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c; // المسافة بالكيلومترات
}

// دالة لتحويل الدرجات إلى راديان
function toRadians(degree) {
  return degree * (Math.PI / 180);
}

// نقطة نهاية لجلب العقارات القريبة ضمن 10 كيلومترات
app.post('/getNearbyProperties', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    // جلب جميع العقارات من قاعدة البيانات
    const allProperties = await Property.find({});

    // حساب المسافة بين موقع المستخدم وكل عقار
    const propertiesWithDistances = allProperties.map((property) => {
      const propertyLatitude = property.location.lat;
      const propertyLongitude = property.location.lng;

      // حساب المسافة
      const distance = calculateDistance(latitude, longitude, propertyLatitude, propertyLongitude);

      return {
        ...property.toObject(),
        distance,
      };
    });

    // تصفية العقارات التي تبعد أقل من أو تساوي 10 كيلومترات
    const nearbyProperties = propertiesWithDistances.filter(
      (property) => property.distance <= 10
    );

    // إرسال الاستجابة
    res.status(200).json({ properties: nearbyProperties });
  } catch (error) {
    console.error('Error fetching nearby properties:', error);
    res.status(500).json({ error: 'Failed to fetch nearby properties' });
  }
});


app.post('/updateRoomAvailability', async (req, res) => {
  const { propertyId, roomType } = req.body;

  try {
    // البحث عن العقار باستخدام propertyId
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // تحديث عدد الغرف المتاحة بناءً على نوع الغرفة
    if (roomType === 'Single') {
      if (property.singleRooms > 0) {
        property.singleRooms -= 1;
      } else {
        return res.status(400).json({ message: 'No single rooms available' });
      }
    } else if (roomType === 'Shared') {
      if (property.sharedRooms > 0) {
        property.sharedRooms -= 1;
      } else {
        return res.status(400).json({ message: 'No shared rooms available' });
      }
    } else {
      return res.status(400).json({ message: 'Invalid room type' });
    }

    // حفظ التغييرات في قاعدة البيانات
    await property.save();

    res.status(200).json({ message: 'Room availability updated successfully', property });
  } catch (error) {
    console.error('Error updating room availability:', error);
    res.status(500).json({ message: 'Failed to update room availability', error: error.message });
  }
});






//الجزء الخاص بلوحة تحكم الادمن

// **تسجيل دخول الادمن**
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // التحقق من وجود البريد الإلكتروني وكلمة المرور
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required.',
      });
    }

    // البحث عن المستخدم في قاعدة البيانات باستخدام البريد الإلكتروني
    const user = await User.findOne({ email });

    // التحقق مما إذا كان المستخدم موجودًا
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found. Please check your email or sign up.',
      });
    }

    // التحقق من صحة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid password. Please try again.',
      });
    }

    // التحقق مما إذا كان نوع الحساب هو "Administrator"
    if (user.accountType !== 'Administrator') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This account is not an Administrator.',
      });
    }

    // إنشاء رمز JWT
    const token = jwt.sign({ id: user._id }, 'your_jwt_secret_key', { expiresIn: '1h' });

    // إرجاع بيانات المشرف مع الرمز
    res.status(200).json({
      status: 'success',
      message: 'Admin login successful!',
      token: token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        accountType: user.accountType,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while logging in.',
      error: error.message,
    });
  }
});

//(1) نقطة النهاية لجلب جميع المستخدمين
app.get('/getAllUsers', async (req, res) => {
  try {
    // جلب جميع المستخدمين من قاعدة البيانات
    const users = await User.find({});

    // التحقق مما إذا كانت هناك مستخدمين
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found',
      });
    }

    // تحويل البيانات إلى التنسيق المطلوب
    const formattedUsers = users.map((user) => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImage: user.profileImage || 'https://via.placeholder.com/50', // صورة افتراضية إذا لم تكن موجودة
      accountType: user.accountType,
      studentId: user.accountType === 'Student' ? user.studentId : null,
      major: user.accountType === 'Student' ? user.major : null,
      universityName: user.accountType === 'University' ? user.universityName : null,
      universityCode: user.accountType === 'University' ? user.universityCode : null,
      universityAddress: user.accountType === 'University' ? user.universityAddress : null,
      studentCount: user.accountType === 'University' ? user.studentCount : null,
    }));

    // إرسال الاستجابة
    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      users: formattedUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
});

app.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // البحث عن المستخدم في قاعدة البيانات
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // إذا كان المستخدم موجودًا، نعيد بياناته
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phoneNumber,
        gender: user.gender,
        accountType: user.accountType,
        profileImage: user.profileImage,
        status: user.status,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
});

//(3)Notifications schema:
const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

//(3.1)getAllNotifcations
app.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find({}).sort({ createdAt: -1 }); // ترتيب حسب الأحدث
    res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully',
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
});

//(3.2)Add Notifications:
app.post('/notifications', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      });
    }

    const newNotification = new Notification({
      title,
      description,
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      message: 'Notification added successfully',
      data: newNotification,
    });
  } catch (error) {
    console.error('Error adding notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add notification',
      error: error.message,
    });
  }
});

//(3.3) Delet Notifications
app.delete('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});


//(3.4)Resend Notifications
app.post('/notifications/:id/resend', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    // هنا يمكن تنفيذ عملية إعادة الإرسال (مثل البريد الإلكتروني أو الإشعارات)
    console.log(`Resending notification: ${notification.title}`);
    res.status(200).json({ message: 'Notification resent successfully' });
  } catch (error) {
    console.error('Error resending notification:', error);
    res.status(500).json({ message: 'Failed to resend notification' });
  }
});


//(3.5)edit Notifications
app.put('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { title, description },
      { new: true }
    );
    if (!updatedNotification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification updated successfully', data: updatedNotification });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});



app.post('/saveMessage', async (req, res) => {
  const { userId, firstName, lastName, email, accountType, profileImage, subject, message } = req.body;

  try {
    // التحقق من وجود جميع الحقول المطلوبة
    if (!userId || !firstName || !lastName || !email || !accountType || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // التحقق من صحة userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId',
      });
    }

    // البحث عن المستخدم بناءً على userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // تحديد بيانات المستقبل يدويًا
    const recipientId = '67fa9e5998eac616535ac1cc';
    const recipientEmail = 'hymaha@cyclelove.cc';
    const recipientAccountType = 'Administrator';

    // التحقق من وجود المستقبل في قاعدة البيانات
    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    // إنشاء رسالة جديدة
    const newMessage = new SupportMessage({
      sender: user._id, // المرسل هو المستخدم الحالي
      recipient: recipientId, // المستقبل هو المستخدم المحدد
      subject: subject, // الموضوع
      message: message, // الرسالة
      senderDetails: {
        firstName: firstName,
        lastName: lastName,
        email: email,
        accountType: accountType,
        profileImage: profileImage || '', // إذا لم تكن صورة الملف الشخصي موجودة، نستخدم قيمة فارغة
      },
    });

    // حفظ الرسالة في قاعدة البيانات
    await newMessage.save();

    // إرجاع استجابة ناجحة
    res.status(201).json({
      success: true,
      message: 'Message saved successfully',
      recipient: {
        _id: recipientId,
        email: recipientEmail,
        accountType: recipientAccountType,
      },
    });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save message',
      error: error.message,
    });
  }
});

//(4)Support schema:
const supportMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  replies: [
    {
      replyText: String,
      repliedBy: String,
      repliedAt: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});



// نموذج الرسائل الداعمة
const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

module.exports = SupportMessage;

//(4.1) add Support message:
app.post('/supportmessages', async (req, res) => {
  try {
    const {
      senderId,
      recipientId,
      subject,
      message,
      firstName,
      lastName,
      email,
      accountType,
      profileImage,
    } = req.body;

    // التحقق من وجود جميع الحقول المطلوبة
    if (!senderId || !recipientId || !subject || !message || !firstName || !lastName || !email || !accountType) {
      return res.status(400).json({
        success: false,
        message: 'All fields (senderId, recipientId, subject, message, firstName, lastName, email, accountType) are required',
      });
    }

    // التحقق من صحة senderId و recipientId
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid senderId or recipientId',
      });
    }

    // التحقق من وجود المرسل والمستقبل في قاعدة البيانات
    const senderUser = await User.findById(senderId);
    const recipientUser = await User.findById(recipientId);

    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: 'Sender user not found',
      });
    }

    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    // إنشاء رسالة جديدة
    const newMessage = new SupportMessage({
      sender: senderId,
      recipient: recipientId,
      subject,
      message,
      senderDetails: {
        firstName,
        lastName,
        email,
        accountType,
        profileImage: profileImage || '', // إذا لم تكن صورة الملف الشخصي موجودة، نستخدم قيمة فارغة
      },
    });

    // حفظ الرسالة في قاعدة البيانات
    await newMessage.save();

    // إرجاع استجابة ناجحة
    res.status(201).json({
      success: true,
      message: 'Support message added successfully',
      data: newMessage,
    });
  } catch (error) {
    console.error('Error adding support message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add support message',
      error: error.message,
    });
  }
});

app.get('/support', async (req, res) => {
  try {
    // جلب جميع الرسائل مع ترتيبها حسب الأحدث
    const messages = await SupportMessage.find({})
      .populate('sender', '_id firstName lastName email accountType profileImage') // تحميل بيانات المرسل
      .populate('recipient', '_id firstName lastName email accountType profileImage') // تحميل بيانات المستقبل
      .sort({ createdAt: -1 }); // ترتيب الرسائل حسب الأحدث

    // التحقق مما إذا كانت هناك رسائل
    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No support messages found',
      });
    }

    // تحويل الرسائل إلى تنسيق مناسب للواجهة الأمامية
    const formattedMessages = messages.map((message) => ({
      _id: message._id,
      sender: message.sender ? {
        _id: message.sender._id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        email: message.sender.email,
        accountType: message.sender.accountType,
        profileImage: message.sender.profileImage || '',
      } : null,
      recipient: message.recipient ? {
        _id: message.recipient._id,
        firstName: message.recipient.firstName,
        lastName: message.recipient.lastName,
        email: message.recipient.email,
        accountType: message.recipient.accountType,
        profileImage: message.recipient.profileImage || '',
      } : null,
      subject: message.subject,
      message: message.message,
      replies: message.replies.map((reply) => ({
        replyText: reply.replyText,
        repliedBy: reply.repliedBy,
        repliedAt: reply.repliedAt,
      })),
      createdAt: message.createdAt,
    }));

    // إرجاع استجابة ناجحة مع الرسائل
    res.status(200).json({
      success: true,
      message: 'Support messages fetched successfully',
      data: formattedMessages,
    });
  } catch (error) {
    console.error('Error fetching support messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support messages',
      error: error.message,
    });
  }
});



//(4.1) delet Support message:
app.delete('/support/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // حذف الرسالة بناءً على ID
    const deletedMessage = await SupportMessage.findByIdAndDelete(id);

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Support message not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Support message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting support message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete support message',
      error: error.message,
    });
  }
});


//(4.2)replay message:
app.post('/support/:messageId/reply', async (req, res) => {
  const { messageId } = req.params;
  const { reply } = req.body;
  try {
    // العثور على الرسالة باستخدام messageId
    const message = await SupportMessage.findById(messageId); // استبدال Message بـ SupportMessage
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // إضافة الرد إلى قائمة الردود
    message.replies.push({
      replyText: reply,
      repliedBy: 'Admin',
      repliedAt: new Date(),
    });

    // حفظ التحديثات
    await message.save();

    // إعادة استجابة ناجحة
    res.status(200).json({ message: 'Reply sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

//(4.3)get messages by userId:
app.get('/user-messages/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // البحث عن جميع الرسائل المرتبطة بالمستخدم
    const messages = await SupportMessage.find({ 'sender':userId })
      .populate('replies') // تحميل الردود المرتبطة بالرسائل
      .exec();

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'No messages found for this user' });
    }

    res.status(200).json({ data: messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user messages' });
  }
});

// تحديث الرسائل القديمة
async function updateOldMessages() {
  try {
    const result = await SupportMessage.updateMany(
      { replies: { $exists: false } },
      { $set: { replies: [] } }
    );
    console.log(`Updated ${result.modifiedCount} messages`);
  } catch (error) {
    console.error('Error updating old messages:', error);
  }
}


// حذف مستخدم بناءً على ID
app.delete('/deleteUser/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // التحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // حذف المستخدم
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



// تشغيل الخادم على المنفذ المحدد
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
