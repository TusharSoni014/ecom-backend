"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  // Method 1: Creating an entirely custom action
  async customOrderController(ctx) {
    try {
      //   ctx.body = "ok";
      // ctx.body has all the body data

      const bodyData = ctx.body;
      const entries = await strapi.entityService.findMany(
        "api::product.product",
        { fields: ["title"], limit: 3 }
      );
      return { data: entries };
    } catch (err) {
      ctx.body = err;
    }
  },

  //overriding coreControllers
  async create(ctx) {
    try {
      const { products } = ctx.request.body;
      const lineItems = await Promise.all(
        products.map(async (item) => {
          const productEntities = await strapi.entityService.findMany(
            "api::product.product",
            {
              filters: {
                key: item.key,
              },
            }
          );

          const realProduct = productEntities[0];

          return {
            price_data: {
              currency: "inr",
              product_data: {
                name: item.title,
              },
              unit_amount: realProduct.price * 100,
            },
            quantity: 1,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
          allowed_countries: ["IN"],
        },
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.CLIENT_BASE_URL}/payment/success`,
        cancel_url: `${process.env.CLIENT_BASE_URL}/payment/failed`,
      });

      await strapi.entityService.create("api::order.order", {
        data: {
          products,
          stripeid: session.id,
        },
      });

      return { strapiId: session.id };
    } catch (error) {
      console.log(error);
      ctx.response.status = 500;
      return error;
    }
  },
}));
