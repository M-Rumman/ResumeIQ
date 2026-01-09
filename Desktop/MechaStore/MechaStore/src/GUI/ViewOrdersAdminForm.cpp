#include <vcl.h>
#pragma hdrstop

#include "ViewOrdersAdminForm.h"
#include "../models/PortalManager.h"
#include "../models/Order.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

extern PortalManager store;
TViewOrders *ViewOrders;

__fastcall TViewOrders::TViewOrders(TComponent* Owner)
    : TForm(Owner)
{
}

void __fastcall TViewOrders::refreshOrders()
{
	Orders->Clear();
    store.loadOrders();

	Orders->Lines->Add("------------------- ORDERS -------------------");

    for (auto &o : store.getOrders())
    {
        AnsiString line;
        line.printf("OrderID: %d | UserID: %d | Total: %.2f",
            o.getId(),
            o.getUserId(),
            o.getTotal()
        );
		Orders->Lines->Add(line);

        for (auto &item : o.getItems())
        {
            AnsiString itemLine;
            itemLine.printf("   %d x %s @ %.2f",
                item.getQuantity(),
                item.getComponentName().c_str(),
                item.getPrice()
            );
			Orders->Lines->Add(itemLine);
        }

        Orders->Lines->Add("---------------------------------------------");
    }
}

void __fastcall TViewOrders::FormShow(TObject *Sender)
{
    refreshOrders();
}

void __fastcall TViewOrders::RefreshClick(TObject *Sender)
{
    refreshOrders();
}

void __fastcall TViewOrders::CloseButtonClick(TObject *Sender)
{
	Close();
}
