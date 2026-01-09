#include <vcl.h>
#pragma hdrstop

#include "AddComponentAdminForm.h"
#include "BrowseComp.h"
#include "../models/PortalManager.h"
#include "../models/Component.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

extern PortalManager store;

TAddComponentAdmin *AddComponentAdmin;

__fastcall TAddComponentAdmin::TAddComponentAdmin(TComponent* Owner)
    : TForm(Owner) {}

void __fastcall TAddComponentAdmin::SaveClick(TObject *Sender)
{
    // 1. Read values from the edits
    AnsiString nameStr = Name->Text;
    double priceVal = StrToFloat(Price->Text);
    int qtyVal = StrToInt(Quantity->Text);

    // 2. Generate an ID for the new component
    int id = store.getComponents().empty() ? 1 : store.getComponents().back().getId() + 1;

    // 3. Create the component object
    Component newComp(id, nameStr.c_str(), "", qtyVal, priceVal, "Admin", "0000000000");

    // 4. Add to store
    store.addComponent(newComp);
    store.saveComponents();  // persist

    ShowMessage("Component Added Successfully!");

    // 5. Refresh the BrowseComponents form if it exists
	if (BrowseComponents)
    {
        BrowseComponents->ShowComponents(); // call the helper
    }

    // Optional: clear fields
    Name->Text = "";
    Price->Text = "";
    Quantity->Text = "";
}
