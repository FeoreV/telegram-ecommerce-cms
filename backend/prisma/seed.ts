import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create super admin user
  const superAdminTelegramId = process.env.SUPER_ADMIN_TELEGRAM_ID || '123456789';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@botrt.local';
  
  const superAdmin = await prisma.user.upsert({
    where: { telegramId: superAdminTelegramId },
    update: { 
      role: 'OWNER',
      email: superAdminEmail 
    },
    create: {
      telegramId: superAdminTelegramId,
      email: superAdminEmail,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'OWNER',
      isActive: true,
    },
  });

  console.log('✅ Super admin created:', superAdmin);

  // Create demo store
  const demoStore = await prisma.store.upsert({
    where: { slug: 'demo-store' },
    update: {},
    create: {
      name: 'Demo Store',
      description: 'Демонстрационный магазин для тестирования функций платформы',
      slug: 'demo-store',
      currency: 'RUB',
      contactInfo: JSON.stringify({
        phone: '+7 (900) 123-45-67',
        email: 'demo@store.com',
        address: 'г. Москва, ул. Примерная, д. 123'
      }),
      settings: JSON.stringify({
        paymentInstructions: 'Оплата производится переводом на карту или наличными при получении',
        deliveryInfo: 'Доставка по Москве в течение 1-2 дней'
      }),
      ownerId: superAdmin.id,
    },
  });

  console.log('✅ Demo store created:', demoStore);

  // Create demo categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: 'Электроника',
        slug: 'electronics',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'clothing' },
      update: {},
      create: {
        name: 'Одежда',
        slug: 'clothing',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'books' },
      update: {},
      create: {
        name: 'Книги',
        slug: 'books',
      },
    }),
  ]);

  console.log('✅ Categories created:', categories.length);

  // Delete existing products first
  await prisma.product.deleteMany({ where: { storeId: demoStore.id } });
  
  // Create demo products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'iPhone 15 Pro',
        description: 'Новейший флагманский смартфон Apple с передовыми технологиями',
        sku: 'IPHONE15PRO',
        price: 89999,
        stock: 10,
        images: JSON.stringify(["https://example.com/iphone15pro.jpg"]),
        storeId: demoStore.id,
        categoryId: categories[0].id,
        variants: {
          create: [
            { name: 'Цвет', value: 'Титановый натуральный', price: 89999, stock: 5 },
            { name: 'Цвет', value: 'Титановый синий', price: 89999, stock: 3 },
            { name: 'Цвет', value: 'Титановый белый', price: 89999, stock: 2 },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Футболка базовая',
        description: 'Качественная хлопковая футболка для повседневной носки',
        sku: 'TSHIRT001',
        price: 1299,
        stock: 50,
        images: JSON.stringify(["https://example.com/tshirt.jpg"]),
        storeId: demoStore.id,
        categoryId: categories[1].id,
        variants: {
          create: [
            { name: 'Размер', value: 'S', stock: 10 },
            { name: 'Размер', value: 'M', stock: 15 },
            { name: 'Размер', value: 'L', stock: 15 },
            { name: 'Размер', value: 'XL', stock: 10 },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Программирование на JavaScript',
        description: 'Полное руководство по современному JavaScript для веб-разработки',
        sku: 'BOOK001',
        price: 2499,
        stock: 25,
        images: JSON.stringify(["https://example.com/jsbook.jpg"]),
        storeId: demoStore.id,
        categoryId: categories[2].id,
      },
    }),
  ]);

  console.log('✅ Demo products created:', products.length);

  // Create demo orders with different statuses and dates
  console.log('📦 Creating demo orders...');
  
  // Create some demo customers first
  const demoCustomers = await Promise.all([
    prisma.user.create({
      data: {
        telegramId: '11111111',
        firstName: 'Анна',
        lastName: 'Смирнова', 
        role: 'CUSTOMER',
        isActive: true,
        lastLoginAt: new Date(),
      }
    }),
    prisma.user.create({
      data: {
        telegramId: '22222222',
        firstName: 'Иван',
        lastName: 'Петров',
        role: 'CUSTOMER', 
        isActive: true,
        lastLoginAt: new Date(),
      }
    }),
    prisma.user.create({
      data: {
        telegramId: '33333333',
        firstName: 'Мария',
        lastName: 'Козлова',
        role: 'CUSTOMER',
        isActive: true,
        lastLoginAt: new Date(),
      }
    })
  ]);

  // Create orders with different dates and statuses
  const orders = [];
  const statuses = ['PENDING_ADMIN', 'PAID', 'SHIPPED', 'DELIVERED'];
  
  for (let i = 0; i < 15; i++) {
    const randomCustomer = demoCustomers[Math.floor(Math.random() * demoCustomers.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Create order with date in last 30 days
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));
    
    const quantity = Math.floor(Math.random() * 3) + 1;
    const price = randomProduct.price;
    const totalAmount = price * quantity;
    
    // Set timestamps based on status
    let paidAt = null;
    let shippedAt = null; 
    let deliveredAt = null;
    
    if (randomStatus === 'PAID' || randomStatus === 'SHIPPED' || randomStatus === 'DELIVERED') {
      paidAt = new Date(orderDate.getTime() + Math.random() * 24 * 60 * 60 * 1000); // 0-24 hours after creation
    }
    
    if (randomStatus === 'SHIPPED' || randomStatus === 'DELIVERED') {
      shippedAt = new Date(paidAt!.getTime() + Math.random() * 48 * 60 * 60 * 1000); // 0-48 hours after payment
    }
    
    if (randomStatus === 'DELIVERED') {
      deliveredAt = new Date(shippedAt!.getTime() + Math.random() * 72 * 60 * 60 * 1000); // 0-72 hours after shipping
    }

    const order = await prisma.order.create({
      data: {
        customerId: randomCustomer.id,
        storeId: demoStore.id,
        status: randomStatus,
        totalAmount,
        orderNumber: `ORD-${Date.now()}-${i}`,
        customerInfo: JSON.stringify({
          name: `${randomCustomer.firstName} ${randomCustomer.lastName}`,
          telegramId: randomCustomer.telegramId
        }),
        currency: 'RUB',
        createdAt: orderDate,
        paidAt,
        shippedAt,
        deliveredAt,
        items: {
          create: {
            productId: randomProduct.id,
            quantity,
            price,
          }
        }
      }
    });
    
    orders.push(order);
  }

  console.log('✅ Demo orders created:', orders.length);

  // Update product stock based on sold quantities
  for (const product of products) {
    const soldQuantity = orders
      .filter(order => order.status !== 'PENDING_ADMIN')
      .reduce((total, order) => {
        // This is simplified - in real app would check order items
        return total + Math.floor(Math.random() * 2);
      }, 0);
    
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: Math.max(0, product.stock - soldQuantity) }
    });
  }

  console.log('✅ Product stock updated based on orders');
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });