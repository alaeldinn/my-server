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
const app = express();
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
  accountType: { type: String, enum: ['Student', 'University'] },
  studentId: String,
  major: String,
  universityName: String,  
  universityCode: String,  
  universityAddress: String,
  studentCount: Number,   
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
  pricePeriod: { type: String, enum: ['day', 'month', 'semester'], required: true }, // فترة السعر
  state: { type: String, required: true }, // الولاية
  index: { type: Number, default: 0 }, // الفهرس
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
    // جلب جميع العقارات من قاعدة البيانات
    const properties = await Property.find({});

    // تحويل البيانات إلى التنسيق المطلوب
    const formattedProperties = properties.map((property, index) => ({
      _id: property._id,
      hostelName: property.hostelName, // استخدام hostelName بدلاً من type
      pricePeriod: property.pricePeriod || 'N/A', // إرجاع الفترة الزمنية
      singleRooms: parseFloat(property.singleRooms) || 0, // تحويل singleRooms إلى Double
      sharedRooms: parseFloat(property.sharedRooms) || 0, // تحويل sharedRooms إلى Double
      bedsPerSharedRoom: parseFloat(property.bedsPerSharedRoom) || 0, // تحويل bedsPerSharedRoom إلى Double
      singleRoomPrice: parseFloat(property.singleRoomPrice) || 0, // تحويل singleRoomPrice إلى Double
      sharedRoomPrice: parseFloat(property.sharedRoomPrice) || 0, // تحويل sharedRoomPrice إلى Double
      index: index + 1, // استخدام الفهرس الذي يتم تمريره تلقائيًا في map
      imageUrls: property.imageUrls || [], // استخدام أول صورة كصورة رئيسية
      location: {
        lat: parseFloat(property.location.lat), // تحويل lat إلى Double
        lng: parseFloat(property.location.lng), // تحويل lng إلى Double
      },
      ownerId: property.ownerId,
      profileImage: property.profileImage,
      bathroomType: property.bathroomType,
      internetAvailable: property.internetAvailable,
      cleaningService: property.cleaningService,
      maintenanceService: property.maintenanceService,
      securitySystem: property.securitySystem,
      emergencyMeasures: property.emergencyMeasures,
      goodLighting: property.goodLighting,
      sharedAreas: property.sharedAreas,
      studyRooms: property.studyRooms,
      laundryRoom: property.laundryRoom,
      sharedKitchen: property.sharedKitchen,
      foodService: property.foodService,
      effectiveManagement: property.effectiveManagement,
      psychologicalSupport: property.psychologicalSupport,
      state: property.state, // إضافة الولاية
    }));

    // استخدام JSON.stringify لطباعة البيانات بشكل مفصل
    console.log('Response Data:', JSON.stringify({ properties: formattedProperties }, null, 2));

    // إرسال الاستجابة
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
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true }, // معرف العقار
  ownerId: { type: String, required: true }, // معرف المالك
  firstName: { type: String, required: true }, // الاسم الأول للطالب
  lastName: { type: String, required: true }, // الاسم الأخير للطالب
  email: { type: String, required: true }, // البريد الإلكتروني للطالب
  phone: { type: String, required: true }, // رقم الهاتف للطالب
  roomType: { type: String, required: true, enum: ['Single', 'Shared'] }, // نوع الغرفة
  price: { type: Number, required: true }, // سعر العقار
  pricePeriod: { type: String, required: true }, // الفترة الزمنية للسعر
  bookingDate: { type: Date, default: Date.now }, // تاريخ الحجز
});

const Booking = mongoose.model('Booking', bookingSchema);

// نقطة نهاية لتسجيل الحجز
app.post('/submitBooking', async (req, res) => {
  console.log(req.body); // طباعة البيانات المستلمة
  try {
    const {
      propertyId,
      ownerId,
      firstName,
      lastName,
      email,
      phone,
      roomType,
      price,
      pricePeriod,
    } = req.body;

    // التحقق من وجود جميع الحقول المطلوبة
    if (!propertyId || !ownerId || !firstName || !lastName || !email || !phone || !roomType || !price || !pricePeriod) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // التحقق من صحة رقم الهاتف (يمكن إضافة مكتبة مثل libphonenumber-js للتحقق من صحة الرقم)
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // إنشاء حجز جديد
    const newBooking = new Booking({
      propertyId,
      ownerId,
      firstName,
      lastName,
      email,
      phone,
      roomType,
      price,
      pricePeriod,
    });

    // حفظ الحجز في قاعدة البيانات
    await newBooking.save();

    // إرسال استجابة ناجحة
    res.status(201).json({ message: 'Booking submitted successfully', booking: newBooking });
  } catch (error) {
    console.error('Error submitting booking:', error);
    res.status(500).json({ message: 'Failed to submit booking', error: error.message });
  }
});

// دالة للتحقق من صحة رقم الهاتف (يمكن استبدالها بمكتبة مثل libphonenumber-js)
function isValidPhoneNumber(phone) {
  // يمكن إضافة منطق للتحقق من صحة الرقم بناءً على رمز الدولة
  return phone && phone.length >= 7 && phone.length <= 15; // مثال بسيط
}


app.get('/booking/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    // البحث عن الحجز باستخدام رقم الهاتف (phone) وجلب بيانات العقار المرتبط
    const booking = await Booking.findOne({ phone }).populate('propertyId');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // تحويل propertyId إلى S/N
    const serialNumber = booking.propertyId._id.toString().substring(0, 6).toUpperCase();

    // إرسال البيانات المطلوبة
    res.status(200).json({
      bookingDate: booking.bookingDate.toLocaleString(), // تاريخ الحجز
      firstName: booking.firstName, // الاسم الأول
      lastName: booking.lastName, // الاسم الأخير
      email: booking.email, // البريد الإلكتروني
      phone: booking.phone, // رقم الهاتف
      roomType: booking.roomType, // نوع الغرفة
      price: booking.price, // السعر
      pricePeriod: booking.pricePeriod, // الفترة الزمنية
      serialNumber, // الرقم التسلسلي (S/N)
      property: {
        hostelName: booking.propertyId.hostelName, // اسم العقار
        location: booking.propertyId.location, // موقع العقار
        imageUrls: booking.propertyId.imageUrls, // صور العقار
      },
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ message: 'Failed to fetch booking details', error: error.message });
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

app.post('/submitRating', async (req, res) => {
  const { propertyId, userId, rating, comment } = req.body;

  try {
    // التحقق من وجود العقار والمستخدم
    const property = await Property.findById(propertyId);
    const user = await User.findById(userId);

    if (!property || !user) {
      return res.status(404).json({ message: 'Property or user not found' });
    }

    // إضافة التقييم إلى العقار
    property.ratings.push({ userId, rating, comment });
    await property.save();

    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ message: 'Failed to submit rating', error: error.message });
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

// تشغيل الخادم على المنفذ المحدد
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
