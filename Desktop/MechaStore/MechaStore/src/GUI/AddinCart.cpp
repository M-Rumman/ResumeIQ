#include <vcl.h>
#pragma hdrstop

#include "AddinCart.h"
#include "../models/PortalManager.h"
#include "../models/Component.h"

extern PortalManager store;

#pragma package(smart_init)
#pragma resource "*.dfm"

// constructor with reference to cart
__fastcall TAddToCartForm::TAddToCartForm(TComponent* Owner, User *u, std::vector<OrderItem> &cart)
    : TForm(Owner), loggedInUser(u), userCart(cart)
{
}

void __fastcall TAddToCartForm::FormShow(TObject *Sender)
{
    store.loadComponents(); // load from storage
    Components->Clear();
    for (auto &c : store.getComponents())
    {
        Components->Items->Add(
            AnsiString(c.getId()) + " - " + c.getName().c_str()
        );
    }
}

void __fastcall TAddToCartForm::AddClick(TObject *Sender)
{
    if (Components->ItemIndex == -1 || Quantity->Text.IsEmpty())
    {
        ShowMessage("Select component and quantity");
        return;
    }

    int index = Components->ItemIndex;
    int qty = Quantity->Text.ToInt();
    Component &c = store.getComponents()[index];

    if (qty <= 0 || qty > c.getQuantity())
    {
        ShowMessage("Invalid quantity");
        return;
    }

    // Add to the dashboard cart
    userCart.push_back(OrderItem(c.getId(), c.getName(), qty, c.getPrice()));
    refreshPreview();
}

void TAddToCartForm::refreshPreview()
{
    Preview->Lines->Clear();
    double total = 0;

    for (auto &item : userCart)
    {
        AnsiString line;
        line.printf("%s x %d = %.2f",
            item.getComponentName().c_str(),
            item.getQuantity(),
            item.getPrice() * item.getQuantity()
        );

        Preview->Lines->Add(line);
        total += item.getPrice() * item.getQuantity();
    }

    Preview->Lines->Add("--------------------");

    AnsiString totalLine;
    totalLine.printf("Total: %.2f", total);
    Preview->Lines->Add(totalLine);
}

