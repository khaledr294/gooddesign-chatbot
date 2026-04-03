import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
  MessageType,
  MAX_PRODUCTS_PER_PAGE,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { prisma } from '../lib/prisma.js';
import { buildMainMenuResult, buttonsMsg, listMsg, textMsg } from './engine.js';

export async function productsFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  switch (session.flowState) {
    case FlowState.CATEGORY_SELECT:
      return handleCategorySelect(message, session);
    case FlowState.PRODUCT_LIST:
      return handleProductList(message, session);
    case FlowState.PRODUCT_DETAIL:
      return handleProductDetail(message, session);
    default:
      return buildMainMenuResult();
  }
}

async function handleCategorySelect(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  // If first entry, show categories
  const choice = message.buttonReplyId || message.listReplyId || message.text?.trim();

  if (choice === 'back_to_menu') return buildMainMenuResult();

  // Load categories
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: 'asc' },
  });

  if (categories.length === 0) {
    return {
      messages: [textMsg('لا توجد تصنيفات متاحة حالياً.')],
      newState: FlowState.MAIN_MENU,
    };
  }

  // If user selected a category
  if (choice && choice.startsWith('cat_')) {
    const categoryId = choice.replace('cat_', '');
    return {
      messages: [],
      newState: FlowState.PRODUCT_LIST,
      sessionUpdates: { selectedCategoryId: categoryId, currentPage: 0 },
    };
  }

  // Show categories as list
  const rows = categories.map((cat) => ({
    id: `cat_${cat.id}`,
    title: cat.name,
  }));

  return {
    messages: [
      listMsg(MSG.CATEGORY_SELECT, 'التصنيفات', [{ title: 'التصنيفات', rows }]),
      buttonsMsg('', [{ id: 'back_to_menu', title: MSG.BACK_TO_MENU }]),
    ],
    newState: FlowState.CATEGORY_SELECT,
  };
}

async function handleProductList(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.listReplyId || message.text?.trim();

  if (choice === 'back_categories') {
    return {
      messages: [],
      newState: FlowState.CATEGORY_SELECT,
      sessionUpdates: { selectedCategoryId: undefined, currentPage: 0 },
    };
  }

  if (choice === 'back_to_menu') return buildMainMenuResult();

  // If user selected a product
  if (choice && choice.startsWith('prod_')) {
    const productId = choice.replace('prod_', '');
    return {
      messages: [],
      newState: FlowState.PRODUCT_DETAIL,
      sessionUpdates: { selectedProductId: productId },
    };
  }

  // Handle pagination
  let page = session.currentPage || 0;
  if (choice === 'next_page') page += 1;
  if (choice === 'prev_page' && page > 0) page -= 1;

  // Load products for the selected category
  const categoryId = session.selectedCategoryId;
  if (!categoryId) {
    return {
      messages: [],
      newState: FlowState.CATEGORY_SELECT,
    };
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      categories: { some: { categoryId } },
    },
    orderBy: { createdAt: 'desc' },
    skip: page * MAX_PRODUCTS_PER_PAGE,
    take: MAX_PRODUCTS_PER_PAGE + 1, // +1 to check if there's a next page
  });

  const hasNextPage = products.length > MAX_PRODUCTS_PER_PAGE;
  const displayProducts = products.slice(0, MAX_PRODUCTS_PER_PAGE);

  if (displayProducts.length === 0) {
    return {
      messages: [
        textMsg('لا توجد منتجات في هذا التصنيف حالياً.'),
        buttonsMsg('', [{ id: 'back_categories', title: '🔙 التصنيفات' }]),
      ],
      newState: FlowState.PRODUCT_LIST,
    };
  }

  const rows = displayProducts.map((p) => ({
    id: `prod_${p.id}`,
    title: p.name.substring(0, 24),
    description: `${p.salePrice || p.price} ر.س${p.quantity <= 0 ? ' - نفدت الكمية' : ''}`,
  }));

  const navButtons: { id: string; title: string }[] = [];
  if (page > 0) navButtons.push({ id: 'prev_page', title: '⬅️ السابق' });
  if (hasNextPage) navButtons.push({ id: 'next_page', title: '➡️ التالي' });
  navButtons.push({ id: 'back_categories', title: '🔙 التصنيفات' });

  return {
    messages: [
      listMsg(MSG.PRODUCT_LIST, 'المنتجات', [{ title: 'المنتجات', rows }]),
      buttonsMsg('', navButtons.slice(0, 3)), // WhatsApp max 3 buttons
    ],
    newState: FlowState.PRODUCT_LIST,
    sessionUpdates: { currentPage: page },
  };
}

async function handleProductDetail(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();

  if (choice === 'back_products') {
    return {
      messages: [],
      newState: FlowState.PRODUCT_LIST,
      sessionUpdates: { selectedProductId: undefined },
    };
  }

  if (choice === 'add_to_cart' || choice === 'customize') {
    const product = await prisma.product.findUnique({
      where: { id: session.selectedProductId! },
    });
    if (!product) {
      return {
        messages: [textMsg('المنتج غير متوفر.')],
        newState: FlowState.PRODUCT_LIST,
      };
    }

    if (product.hasCustomization) {
      return {
        messages: [textMsg(MSG.CUSTOMIZATION_START)],
        newState: FlowState.CUSTOMIZATION,
        sessionUpdates: {
          customization: {
            productId: product.id,
            confirmed: false,
          },
        },
      };
    }

    // Add directly to cart (no customization)
    const cartItem = {
      productId: product.id,
      productName: product.name,
      price: product.salePrice || product.price,
      quantity: 1,
      imageUrl: product.imageUrl || undefined,
    };
    const cartItems = [...(session.cartItems || []), cartItem];

    return {
      messages: [
        textMsg(MSG.ADDED_TO_CART(product.name)),
        buttonsMsg('ماذا تريد أن تفعل؟', [
          { id: 'menu_products', title: '🛍 تابع التسوق' },
          { id: 'menu_cart', title: '🛒 عرض السلة' },
        ]),
      ],
      newState: FlowState.MAIN_MENU,
      sessionUpdates: { cartItems },
    };
  }

  // Show product detail
  const product = await prisma.product.findUnique({
    where: { id: session.selectedProductId! },
  });

  if (!product) {
    return {
      messages: [textMsg('المنتج غير متوفر.')],
      newState: FlowState.PRODUCT_LIST,
    };
  }

  if (product.quantity <= 0) {
    return {
      messages: [
        {
          type: MessageType.IMAGE,
          imageUrl: product.imageUrl || undefined,
          text: MSG.PRODUCT_DETAIL(product.name, product.salePrice || product.price, product.description),
        },
        textMsg(MSG.OUT_OF_STOCK),
        buttonsMsg('', [{ id: 'back_products', title: '🔙 المنتجات' }]),
      ],
      newState: FlowState.PRODUCT_DETAIL,
    };
  }

  const actionButton = product.hasCustomization
    ? { id: 'customize', title: '🎨 تخصيص وإضافة' }
    : { id: 'add_to_cart', title: '🛒 إضافة للسلة' };

  return {
    messages: [
      {
        type: MessageType.IMAGE,
        imageUrl: product.imageUrl || undefined,
        text: MSG.PRODUCT_DETAIL(product.name, product.salePrice || product.price, product.description),
      },
      buttonsMsg('', [actionButton, { id: 'back_products', title: '🔙 المنتجات' }]),
    ],
    newState: FlowState.PRODUCT_DETAIL,
  };
}
