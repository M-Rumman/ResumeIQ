#include <vcl.h>
#pragma hdrstop

#include "DeleteComponentAdminForm.h"
#include "../models/PortalManager.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

extern PortalManager store;
TDeleteComponent *DeleteComponent;

__fastcall TDeleteComponent::TDeleteComponent(TComponent* Owner)
    : TForm(Owner)
{
}

void __fastcall TDeleteComponent::DeleteClick(TObject *Sender)
{
    if (ID->Text.IsEmpty())
    {
        ShowMessage("Enter component ID");
        return;
    }

    int id = ID->Text.ToInt();
    auto &components = store.getComponents();

    auto it = std::remove_if(
        components.begin(),
        components.end(),
        [id](Component &c){ return c.getId() == id; }
    );

    if (it == components.end())
    {
        ShowMessage("Component not found");
        return;
    }

    components.erase(it, components.end());
    store.saveComponents();

    ShowMessage("Component deleted. Carts will auto-refresh.");
    Close();
}

