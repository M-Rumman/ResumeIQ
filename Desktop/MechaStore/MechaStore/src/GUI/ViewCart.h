#ifndef ViewCartH
#define ViewCartH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include <vector>

#include "../models/OrderItem.h"

class TCartView : public TForm
{
__published:
	TMemo *Components;
	TButton *CloseCart;
	void __fastcall CloseCartClick(TObject *Sender);

public:
    __fastcall TCartView(TComponent* Owner);

    void setCartItems(const std::vector<OrderItem> &items)
    {
        Components->Clear();
        double total = 0;

        for (auto &item : items)
        {
            AnsiString line;
            line.sprintf("%s x %d = %.2f",
                item.getComponentName().c_str(),
                item.getQuantity(),
                item.getPrice() * item.getQuantity());

            Components->Lines->Add(line);
            total += item.getPrice() * item.getQuantity();
        }

        Components->Lines->Add("----------------------");

        AnsiString totalLine;
        totalLine.sprintf("Total: %.2f", total);
        Components->Lines->Add(totalLine);
    }
};

#endif

