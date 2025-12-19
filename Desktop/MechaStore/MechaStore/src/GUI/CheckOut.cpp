#include <vcl.h>
#pragma hdrstop

#include "CheckOut.h"
#include "PortalManager.h"
#include "Component.h"
#include "../models/Order.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

extern PortalManager store;

__fastcall TCheckOutForm::TCheckOutForm(TComponent* Owner)
    : TForm(Owner)
{
}

void TCheckOutForm::setCartItems(const std::vector<OrderItem> &items)
{
    cartItems = items;
    Summary->Clear();

    double total = 0;

    for (auto &item : cartItems)
    {
        AnsiString line;
        line.sprintf("%s x %d = %.2f",
            item.getComponentName().c_str(),
            item.getQuantity(),
            item.getPrice() * item.getQuantity());

        Summary->Lines->Add(line);
        total += item.getPrice() * item.getQuantity();
    }

    Total->Caption = "Total: " + FormatFloat("0.00", total);
}

void __fastcall TCheckOutForm::CancelClick(TObject *Sender)
{
    ModalResult = mrCancel;
}

void __fastcall TCheckOutForm::ConfirmClick(TObject *Sender)
{
    if (orderPlaced) return;

    orderPlaced = true;
    Confirm->Enabled = false;

    Summary->Lines->Add("");
    Summary->Lines->Add("? Order Placed Successfully");
    Summary->Lines->Add("");
    Summary->Lines->Add("Seller Details:");
    Summary->Lines->Add("------------------------");

	//SHOW SELLER INFO FIRST
    for (auto &item : cartItems)
    {
        Component* c = store.findComponentById(item.getComponentId());
        if (c)
        {
            Summary->Lines->Add(
                "Component: " + UnicodeString(c->getName().c_str())
            );
            Summary->Lines->Add(
                "Seller: " + UnicodeString(c->getSellerName().c_str())
            );
            Summary->Lines->Add(
                "WhatsApp: " + UnicodeString(c->getSellerWhatsapp().c_str())
            );
            Summary->Lines->Add(
                "Quantity: " + IntToStr(item.getQuantity())
            );
            Summary->Lines->Add("");
        }
    }

    //NOW deduct stock & save
    store.processOrder(cartItems);

    Order order;
    order.setId(store.generateOrderId());
    order.setItems(cartItems);
    order.recalculateTotal();

    store.addOrder(order);
    store.saveOrders();
}


